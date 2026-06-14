from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models import User, SupportTicket, TicketReply
from app.utils.auth import get_current_user
from app.utils.email_sender import send_system_email

router = APIRouter(prefix="/api/tickets", tags=["Tickets"])

class TicketCreate(BaseModel):
    title: str
    description: str
    priority: str = "medium"  # low, medium, high

class ReplyCreate(BaseModel):
    message: str

@router.get("")
async def list_user_tickets(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetch all support tickets belonging to the current user."""
    query = select(SupportTicket).where(SupportTicket.user_id == current_user["id"]).order_by(SupportTicket.created_at.desc())
    res = await db.execute(query)
    tickets = res.scalars().all()
    return [t.to_dict() for t in tickets]

@router.post("")
async def create_user_ticket(
    request: TicketCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a support ticket for the user."""
    title = request.title.strip()
    description = request.description.strip()
    priority = request.priority.strip().lower()
    
    if not title or not description:
        raise HTTPException(status_code=400, detail="Title and description cannot be empty.")
    if priority not in ["low", "medium", "high"]:
        priority = "medium"

    ticket = SupportTicket(
        user_id=current_user["id"],
        title=title,
        description=description,
        status="open",
        priority=priority
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    # Send confirmation email notification to the user
    user_email = current_user["email"]
    subject = f"Support Ticket Created: {title}"
    body = (
        f"Hello {current_user.get('name', 'User')},\n\n"
        f"Your support ticket has been successfully created.\n\n"
        f"Ticket Details:\n"
        f"---------------------------\n"
        f"Title: {title}\n"
        f"Priority: {priority.upper()}\n"
        f"Description: {description}\n\n"
        f"Our support team will review it and get back to you shortly.\n\n"
        f"Best regards,\n"
        f"GetLeads Team"
    )
    await send_system_email(user_email, subject, body, db)

    return ticket.to_dict()

@router.get("/{ticket_id}")
async def get_ticket_details(
    ticket_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get single ticket details along with replies thread."""
    # Find ticket
    q = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = q.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    
    # Check authorization (only owners or admins can see)
    if ticket.user_id != current_user["id"] and not current_user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Not authorized to view this ticket.")

    # Find replies
    q_replies = await db.execute(select(TicketReply).where(TicketReply.ticket_id == ticket_id).order_by(TicketReply.created_at.asc()))
    replies = q_replies.scalars().all()
    
    return {
        "ticket": ticket.to_dict(),
        "replies": [r.to_dict() for r in replies]
    }

@router.post("/{ticket_id}/reply")
async def reply_to_ticket(
    ticket_id: str,
    request: ReplyCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a new message (reply) from the user to their support ticket."""
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # Find ticket
    q = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = q.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    # Check authorization (only owners can reply to user API)
    if ticket.user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to reply to this ticket.")

    # Create reply
    reply = TicketReply(
        ticket_id=ticket.id,
        sender_email=current_user["email"],
        is_admin_reply=False,
        message=message
    )
    db.add(reply)
    
    # Update ticket status back to open if closed
    if ticket.status in ["closed", "resolved"]:
        ticket.status = "open"
        
    await db.commit()
    await db.refresh(reply)
    
    return reply.to_dict()
