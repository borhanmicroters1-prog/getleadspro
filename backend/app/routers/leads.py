import io
import csv
import uuid
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete, and_, or_, func
from typing import List, Optional, Dict
from pydantic import BaseModel
from datetime import datetime, timezone

from app.database import get_db
from app.models import User, Lead, CreditsLog, Blacklist, Campaign, CampaignLead
from app.utils.auth import get_current_user
from app.services.scraper import scrape_google_maps_leads, scrape_facebook_ads_leads

router = APIRouter(prefix="/api/leads", tags=["Leads"])

# Global dictionary to track async scraping tasks
# In production, this would be Redis/Celery
active_tasks: Dict[str, Dict] = {}

class ScrapeRequest(BaseModel):
    keyword: str
    max_results: int = 50
    extract_emails: bool = True
    country: Optional[str] = "BD"  # Used for FB ads

# Helper background task for Google Maps scraping
async def run_google_maps_scrape_task(
    task_id: str, 
    user_id: str, 
    keyword: str, 
    max_results: int, 
    extract_emails: bool,
    db_sessionmaker
):
    active_tasks[task_id] = {
        "status": "running",
        "progress": 20,
        "results_count": 0,
        "credits_deducted": 0,
        "message": "Initiating search on Google Maps..."
    }
    
    try:
        # 1. Run scraping service
        leads_scraped = await scrape_google_maps_leads(keyword, max_results, extract_emails)
        
        active_tasks[task_id]["progress"] = 70
        active_tasks[task_id]["message"] = "Processing results and saving to database..."
        
        async with db_sessionmaker() as db:
            # Fetch user to check and update credits
            user_res = await db.execute(select(User).where(User.id == user_id))
            user = user_res.scalars().first()
            if not user:
                active_tasks[task_id] = {"status": "failed", "message": "User profile not found."}
                return

            inserted_count = 0
            credits_deducted = 0
            
            for lead_data in leads_scraped:
                # Deduct credit only if it has an email address
                has_email = bool(lead_data.get("email"))
                
                if has_email:
                    if user.credits <= 0:
                        print("User ran out of credits during scraping")
                        break # Stop saving if user has 0 credits remaining
                    
                    # Deduct credit
                    user.credits -= 1
                    credits_deducted += 1
                
                # Check for duplicates per user and campaign (None for scraped leads)
                dup_res = await db.execute(
                    select(Lead).where(
                        and_(
                            Lead.user_id == user_id, 
                            Lead.email == lead_data["email"],
                            Lead.campaign_name == None
                        )
                    )
                )
                existing_lead = dup_res.scalars().first()
                
                if not existing_lead:
                    db_lead = Lead(
                        user_id=user_id,
                        name=lead_data["name"],
                        email=lead_data["email"] or f"no-email-{uuid.uuid4().hex[:6]}@example.com", # placeholder if none
                        company=lead_data["company"],
                        phone=lead_data["phone"],
                        website=lead_data["website"],
                        address=lead_data["address"],
                        rating=lead_data["rating"],
                        source="google_maps",
                        status="new",
                        score=lead_data["score"]
                    )
                    db.add(db_lead)
                    inserted_count += 1
            
            # Log credit deduction if any
            if credits_deducted > 0:
                log_entry = CreditsLog(
                    user_id=user_id,
                    action="scrape",
                    amount=-credits_deducted,
                    balance_after=user.credits,
                    reference=f"Google Maps scrape: {keyword}"
                )
                db.add(log_entry)
                
            await db.commit()
            
            active_tasks[task_id] = {
                "status": "completed",
                "progress": 100,
                "results_count": inserted_count,
                "credits_deducted": credits_deducted,
                "message": f"Successfully scraped and imported {inserted_count} leads."
            }
            
    except Exception as e:
        print(f"Scrape task failed: {e}")
        active_tasks[task_id] = {
            "status": "failed",
            "progress": 100,
            "message": f"Scrape task failed: {str(e)}"
        }

# Helper background task for Facebook Ads scraping
async def run_facebook_ads_scrape_task(
    task_id: str, 
    user_id: str, 
    keyword: str, 
    country: str,
    max_results: int, 
    extract_emails: bool,
    db_sessionmaker
):
    active_tasks[task_id] = {
        "status": "running",
        "progress": 20,
        "results_count": 0,
        "credits_deducted": 0,
        "message": "Initiating search on FB Ads Library..."
    }
    
    try:
        leads_scraped = await scrape_facebook_ads_leads(keyword, country, max_results, extract_emails)
        
        active_tasks[task_id]["progress"] = 70
        active_tasks[task_id]["message"] = "Processing results and saving to database..."
        
        async with db_sessionmaker() as db:
            user_res = await db.execute(select(User).where(User.id == user_id))
            user = user_res.scalars().first()
            if not user:
                active_tasks[task_id] = {"status": "failed", "message": "User profile not found."}
                return

            inserted_count = 0
            credits_deducted = 0
            
            for lead_data in leads_scraped:
                has_email = bool(lead_data.get("email"))
                
                if has_email:
                    if user.credits <= 0:
                        break
                    user.credits -= 1
                    credits_deducted += 1
                
                dup_res = await db.execute(
                    select(Lead).where(
                        and_(
                            Lead.user_id == user_id,
                            Lead.email == lead_data["email"],
                            Lead.campaign_name == None
                        )
                    )
                )
                existing_lead = dup_res.scalars().first()
                
                if not existing_lead:
                    db_lead = Lead(
                        user_id=user_id,
                        name=lead_data["name"],
                        email=lead_data["email"] or f"no-email-{uuid.uuid4().hex[:6]}@example.com",
                        company=lead_data["company"],
                        phone=lead_data["phone"],
                        website=lead_data["website"],
                        address=lead_data["address"],
                        rating=lead_data["rating"],
                        source="facebook_ads",
                        status="new",
                        score=lead_data["score"]
                    )
                    db.add(db_lead)
                    inserted_count += 1
            
            if credits_deducted > 0:
                log_entry = CreditsLog(
                    user_id=user_id,
                    action="scrape",
                    amount=-credits_deducted,
                    balance_after=user.credits,
                    reference=f"FB Ads scrape: {keyword}"
                )
                db.add(log_entry)
                
            await db.commit()
            
            active_tasks[task_id] = {
                "status": "completed",
                "progress": 100,
                "results_count": inserted_count,
                "credits_deducted": credits_deducted,
                "message": f"Successfully scraped and imported {inserted_count} advertiser leads."
            }
            
    except Exception as e:
        print(f"Scrape task failed: {e}")
        active_tasks[task_id] = {
            "status": "failed",
            "progress": 100,
            "message": f"Scrape task failed: {str(e)}"
        }

# ==========================================
# API Routes
# ==========================================

@router.post("/scrape/google-maps")
async def trigger_google_maps_scrape(
    request: ScrapeRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check user credits
    user_res = await db.execute(select(User).where(User.id == current_user["id"]))
    user = user_res.scalars().first()
    if not user or user.credits <= 0:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Insufficient credits. Please upgrade your plan."
        )
        
    task_id = str(uuid.uuid4())
    active_tasks[task_id] = {
        "status": "pending",
        "progress": 0,
        "message": "Queuing scraping task..."
    }
    
    # We pass the sessionmaker class or session details to background task
    from app.database import async_session_maker
    background_tasks.add_task(
        run_google_maps_scrape_task,
        task_id,
        current_user["id"],
        request.keyword,
        request.max_results,
        request.extract_emails,
        async_session_maker
    )
    
    return {"task_id": task_id, "status": "pending"}

@router.post("/scrape/facebook-ads")
async def trigger_facebook_ads_scrape(
    request: ScrapeRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user_res = await db.execute(select(User).where(User.id == current_user["id"]))
    user = user_res.scalars().first()
    if not user or user.credits <= 0:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Insufficient credits. Please upgrade your plan."
        )
        
    task_id = str(uuid.uuid4())
    active_tasks[task_id] = {
        "status": "pending",
        "progress": 0,
        "message": "Queuing scraping task..."
    }
    
    from app.database import async_session_maker
    background_tasks.add_task(
        run_facebook_ads_scrape_task,
        task_id,
        current_user["id"],
        request.keyword,
        request.country or "BD",
        request.max_results,
        request.extract_emails,
        async_session_maker
    )
    
    return {"task_id": task_id, "status": "pending"}

@router.get("/scrape/status/{task_id}")
async def get_scrape_task_status(task_id: str):
    if task_id not in active_tasks:
        raise HTTPException(status_code=404, detail="Scraping task not found.")
    return active_tasks[task_id]

@router.post("/upload")
async def upload_csv_leads(
    file: UploadFile = File(...),
    campaign_id: Optional[str] = None,
    campaign_name: Optional[str] = None,
    project_name: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    campaign = None
    target_project_name = None
    
    # Resolve project name
    if project_name and project_name.strip() and project_name != "null" and project_name != "undefined":
        target_project_name = project_name.strip()
    elif campaign_name and campaign_name.strip() and campaign_name != "null" and campaign_name != "undefined":
        target_project_name = campaign_name.strip()

    if campaign_id and campaign_id != "null" and campaign_id != "undefined" and campaign_id.strip():
        camp_res = await db.execute(
            select(Campaign).where(
                and_(Campaign.id == campaign_id, Campaign.user_id == current_user["id"])
            )
        )
        campaign = camp_res.scalars().first()
        if not campaign:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected campaign not found."
            )
        target_project_name = campaign.name

    # Read file content
    contents = await file.read()
    decoded = contents.decode("utf-8-sig").splitlines() # handle UTF-8 BOM
    reader = csv.DictReader(decoded)
    
    # Helper function to find a fieldname flexibly matching any candidates
    def find_header(candidates):
        # 1. Exact match (case insensitive, stripped)
        for h in (reader.fieldnames or []):
            hl = h.strip().lower()
            if hl in candidates:
                return h
        # 2. Substring match
        for h in (reader.fieldnames or []):
            hl = h.strip().lower()
            for c in candidates:
                if c in hl or hl in c:
                    return h
        return None

    email_candidates = ["email", "email address", "email_address", "mail"]
    email_key = find_header(email_candidates)
    if not email_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file must contain an 'email' column."
        )

    first_name_candidates = ["first name", "first_name", "firstname", "first"]
    last_name_candidates = ["last name", "last_name", "lastname", "last"]
    name_candidates = ["name", "full name", "full_name", "fullname"]
    website_candidates = ["website", "web", "url", "site", "website link", "website_link"]
    company_candidates = ["company", "company name", "company_name", "organization", "org"]
    phone_candidates = ["phone", "phone number", "phone_number", "mobile", "tel", "contact"]
    title_candidates = ["title", "role", "job title", "job_title", "designation", "position"]

    first_name_key = find_header(first_name_candidates)
    last_name_key = find_header(last_name_candidates)
    name_key = find_header(name_candidates)
    website_key = find_header(website_candidates)
    company_key = find_header(company_candidates)
    phone_key = find_header(phone_candidates)
    title_key = find_header(title_candidates)
    
    parsed = 0
    skipped = 0
    inserted = 0
    
    for row in reader:
        email = row[email_key].strip()
        if not email or "@" not in email:
            skipped += 1
            continue
            
        parsed += 1
        
        # Check database for duplicates per user and project
        dup_res = await db.execute(
            select(Lead).where(
                and_(
                    Lead.user_id == current_user["id"], 
                    Lead.email == email,
                    Lead.campaign_name == target_project_name
                )
            )
        )
        existing_lead = dup_res.scalars().first()
        
        if existing_lead:
            # If lead already exists, we might still want to link it to the campaign
            # if they upload it explicitly for this campaign and it's not already linked
            if campaign:
                dup_cl = await db.execute(
                    select(CampaignLead).where(
                        and_(CampaignLead.campaign_id == campaign.id, CampaignLead.lead_id == existing_lead.id)
                    )
                )
                if not dup_cl.scalars().first():
                    # Check if campaign has subject_b for A/B split versioning
                    # Alternatively assign subject versions
                    c_leads_count_res = await db.execute(
                        select(func.count(CampaignLead.id)).where(CampaignLead.campaign_id == campaign.id)
                    )
                    c_leads_count = c_leads_count_res.scalar() or 0
                    assigned_subj = "a"
                    if campaign.subject_b and c_leads_count % 2 == 1:
                        assigned_subj = "b"
                        
                    c_lead = CampaignLead(
                        campaign_id=campaign.id,
                        lead_id=existing_lead.id,
                        status="pending",
                        assigned_subject=assigned_subj
                    )
                    db.add(c_lead)
                    
                    # Update lead's campaign name categorisation
                    existing_lead.campaign_name = campaign.name
            skipped += 1
            continue
            
        # Resolve name
        name_val = ""
        if name_key and row[name_key]:
            name_val = row[name_key].strip()
        elif first_name_key or last_name_key:
            fname = row[first_name_key].strip() if (first_name_key and row[first_name_key]) else ""
            lname = row[last_name_key].strip() if (last_name_key and row[last_name_key]) else ""
            name_val = f"{fname} {lname}".strip()
            
        if not name_val:
            name_val = email.split("@")[0].capitalize()

        # Create lead (CSV upload doesn't cost credits)
        db_lead = Lead(
            user_id=current_user["id"],
            name=name_val,
            email=email,
            company=row[company_key].strip() if (company_key and row[company_key]) else "",
            phone=row[phone_key].strip() if (phone_key and row[phone_key]) else "",
            website=row[website_key].strip() if (website_key and row[website_key]) else "",
            title=row[title_key].strip() if (title_key and row[title_key]) else None,
            source="csv_upload",
            campaign_name=target_project_name,
            status="new"
        )
        db.add(db_lead)
        await db.flush() # Flush to populate db_lead.id
        
        # Link to campaign if campaign is provided
        if campaign:
            c_leads_count_res = await db.execute(
                select(func.count(CampaignLead.id)).where(CampaignLead.campaign_id == campaign.id)
            )
            c_leads_count = c_leads_count_res.scalar() or 0
            assigned_subj = "a"
            if campaign.subject_b and c_leads_count % 2 == 1:
                assigned_subj = "b"
                
            c_lead = CampaignLead(
                campaign_id=campaign.id,
                lead_id=db_lead.id,
                status="pending",
                assigned_subject=assigned_subj
            )
            db.add(c_lead)
            
        inserted += 1
        
    await db.commit()
    
    return {
        "filename": file.filename,
        "parsed_rows": parsed,
        "inserted_leads": inserted,
        "skipped_rows": skipped
    }

@router.get("/projects")
async def get_unique_projects(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Lead.campaign_name).where(
        and_(Lead.user_id == current_user["id"], Lead.campaign_name != None)
    ).distinct()
    res = await db.execute(stmt)
    projects = [p for p in res.scalars().all() if p and p.strip()]
    return sorted(projects)

@router.get("/")
async def list_leads(
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    source: Optional[str] = None,
    status_filter: Optional[str] = None,
    campaign: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    offset = (page - 1) * limit
    
    # Construct base query filtering by current user
    query = select(Lead).where(Lead.user_id == current_user["id"])
    count_query = select(func.count(Lead.id)).where(Lead.user_id == current_user["id"])
    
    # Apply search filters
    if search:
        search_filter = or_(
            Lead.name.ilike(f"%{search}%"),
            Lead.email.ilike(f"%{search}%"),
            Lead.company.ilike(f"%{search}%")
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
        
    # Apply filter by source
    if source:
        query = query.where(Lead.source == source)
        count_query = count_query.where(Lead.source == source)
        
    # Apply filter by status
    if status_filter:
        query = query.where(Lead.status == status_filter)
        count_query = count_query.where(Lead.status == status_filter)
        
    # Apply filter by campaign
    if campaign:
        query = query.where(Lead.campaign_name == campaign)
        count_query = count_query.where(Lead.campaign_name == campaign)
        
    # Get total count
    count_res = await db.execute(count_query)
    total_count = count_res.scalar_one()
    
    # Order by newest leads and paginate
    query = query.order_by(Lead.created_at.desc()).offset(offset).limit(limit)
    leads_res = await db.execute(query)
    leads = leads_res.scalars().all()
    
    return {
        "leads": [lead.to_dict() for lead in leads],
        "total": total_count,
        "page": page,
        "limit": limit
    }

class BulkDeleteRequest(BaseModel):
    lead_ids: List[str]

@router.post("/bulk-delete")
async def bulk_delete_leads(
    request: BulkDeleteRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = delete(Lead).where(
        and_(Lead.id.in_(request.lead_ids), Lead.user_id == current_user["id"])
    )
    result = await db.execute(stmt)
    await db.commit()
    return {"message": f"Successfully deleted {result.rowcount} leads."}

@router.delete("/clear-all")
async def clear_all_leads(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = delete(Lead).where(Lead.user_id == current_user["id"])
    result = await db.execute(stmt)
    await db.commit()
    return {"message": f"Successfully cleared all {result.rowcount} leads."}

@router.delete("/{lead_id}")
async def delete_lead(
    lead_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify owner before delete
    stmt = delete(Lead).where(
        and_(Lead.id == lead_id, Lead.user_id == current_user["id"])
    )
    result = await db.execute(stmt)
    await db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Lead not found or unauthorized.")
        
    return {"message": "Lead deleted successfully."}

@router.get("/export")
async def export_leads_csv(
    search: Optional[str] = None,
    source: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Construct query
    query = select(Lead).where(Lead.user_id == current_user["id"])
    
    if search:
        query = query.where(
            or_(
                Lead.name.ilike(f"%{search}%"),
                Lead.email.ilike(f"%{search}%"),
                Lead.company.ilike(f"%{search}%")
            )
        )
    if source:
        query = query.where(Lead.source == source)
    if status_filter:
        query = query.where(Lead.status == status_filter)
        
    query = query.order_by(Lead.created_at.desc())
    res = await db.execute(query)
    leads = res.scalars().all()
    
    # Write to a string buffer CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow(["Name", "Email", "Title", "Company", "Phone", "Website", "Address", "Rating", "Source", "Status", "Created At"])
    
    for lead in leads:
        writer.writerow([
            lead.name or "",
            lead.email,
            lead.title or "",
            lead.company or "",
            lead.phone or "",
            lead.website or "",
            lead.address or "",
            lead.rating or "",
            lead.source,
            lead.status,
            lead.created_at.strftime("%Y-%m-%d %H:%M:%S") if lead.created_at else ""
        ])
        
    # Return as Streaming Response CSV download
    output.seek(0)
    response = StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
    )
    response.headers["Content-Disposition"] = "attachment; filename=leads_export.csv"
    return response
