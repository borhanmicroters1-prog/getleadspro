import csv
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete, and_, or_
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models import Blacklist
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/blacklist", tags=["Blacklist"])

class BlacklistCreate(BaseModel):
    type: str  # email or domain
    value: str
    reason: Optional[str] = None

@router.get("")
async def list_blacklist(
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Blacklist).where(Blacklist.user_id == current_user["id"])
    if search:
        search_term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                Blacklist.value.like(search_term),
                Blacklist.reason.like(search_term)
            )
        )
    query = query.order_by(Blacklist.created_at.desc())
    
    result = await db.execute(query)
    items = result.scalars().all()
    return [item.to_dict() for item in items]

@router.post("")
async def add_blacklist_entry(
    request: BlacklistCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    val = request.value.strip().lower()
    entry_type = request.type.strip().lower()

    if not val:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Value cannot be empty."
        )
    if entry_type not in ["email", "domain"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Type must be either 'email' or 'domain'."
        )

    # Check if entry already exists
    q = await db.execute(
        select(Blacklist).where(
            and_(
                Blacklist.user_id == current_user["id"],
                Blacklist.value == val
            )
        )
    )
    existing = q.scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email or domain is already blacklisted."
        )

    entry = Blacklist(
        user_id=current_user["id"],
        type=entry_type,
        value=val,
        reason=request.reason
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry.to_dict()

@router.delete("/{blacklist_id}")
async def remove_blacklist_entry(
    blacklist_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = delete(Blacklist).where(
        and_(
            Blacklist.id == blacklist_id,
            Blacklist.user_id == current_user["id"]
        )
    )
    result = await db.execute(stmt)
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blacklist entry not found or unauthorized."
        )

    return {"message": "Blacklist entry removed successfully."}

@router.post("/import")
async def import_blacklist_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a CSV file."
        )

    try:
        content = await file.read()
        csv_text = content.decode("utf-8")
        reader = csv.reader(io.StringIO(csv_text))
        
        # Read header and guess column indexes
        header = next(reader, None)
        if not header:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty CSV file."
            )

        value_idx = -1
        type_idx = -1
        reason_idx = -1

        # Search for columns
        for idx, col in enumerate(header):
            col_lower = col.strip().lower()
            if col_lower in ["value", "email", "domain", "address"]:
                value_idx = idx
            elif col_lower in ["type", "category"]:
                type_idx = idx
            elif col_lower in ["reason", "details", "comment"]:
                reason_idx = idx

        # Fallback if no clean header match
        if value_idx == -1:
            value_idx = 0  # Assume first column is the value
            
        imported_count = 0
        skipped_count = 0

        for row in reader:
            if not row or value_idx >= len(row):
                continue
                
            val = row[value_idx].strip().lower()
            if not val:
                continue

            # Determine type
            entry_type = "email"
            if type_idx != -1 and type_idx < len(row):
                parsed_type = row[type_idx].strip().lower()
                if parsed_type in ["email", "domain"]:
                    entry_type = parsed_type
            else:
                # Guess type by looking for @ symbol
                if "@" not in val and "." in val:
                    entry_type = "domain"

            reason = ""
            if reason_idx != -1 and reason_idx < len(row):
                reason = row[reason_idx].strip()
            else:
                reason = "Imported via CSV"

            # Check if already exists in DB
            q = await db.execute(
                select(Blacklist).where(
                    and_(
                        Blacklist.user_id == current_user["id"],
                        Blacklist.value == val
                    )
                )
            )
            existing = q.scalars().first()
            if existing:
                skipped_count += 1
                continue

            entry = Blacklist(
                user_id=current_user["id"],
                type=entry_type,
                value=val,
                reason=reason
            )
            db.add(entry)
            imported_count += 1

        if imported_count > 0:
            await db.commit()

        return {
            "message": f"Successfully imported {imported_count} blacklist entries.",
            "imported": imported_count,
            "skipped": skipped_count
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process CSV file: {str(e)}"
        )
