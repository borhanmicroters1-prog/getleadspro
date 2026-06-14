import json
import re
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional, Dict
from pydantic import BaseModel

from app.database import get_db
from app.models import User, Lead
from app.utils.auth import get_current_user
from app.config import settings

router = APIRouter(prefix="/api/emails", tags=["Emails"])

class EmailGenerateRequest(BaseModel):
  lead_id: Optional[str] = None
  lead_name: Optional[str] = None
  company_name: Optional[str] = None
  website: Optional[str] = None
  rating: Optional[float] = None
  source: Optional[str] = None
  prompt_instruction: Optional[str] = None
  provider: str = "claude" # claude, chatgpt, gemini

class SpamCheckRequest(BaseModel):
  subject: str
  body: str

SPAM_KEYWORDS = [
  "free", "click now", "click here", "guaranteed", "100% satisfied", 
  "earn money", "make money", "credit card", "cash", "urgent", 
  "act now", "limited time", "promotion", "order now", "no risk", 
  "risk free", "investment", "multi-level marketing", "double your income", 
  "incredible deal", "lowest price", "special promotion", "apply now"
]

def clean_llm_json(text: str) -> Dict[str, str]:
  # Strip markdown formatting block if present
  text = text.strip()
  if text.startswith("```"):
    # Match ```json ... ``` or ``` ... ```
    match = re.search(r"^(?:```json\s*|```\s*)(.*?)(?:```\s*)$", text, re.DOTALL | re.IGNORECASE)
    if match:
      text = match.group(1).strip()
      
  try:
    return json.loads(text)
  except json.JSONDecodeError:
    # Manual fallback parser using regex if JSON parse fails
    subj_match = re.search(r'"subject"\s*:\s*"(.*?)"', text, re.DOTALL)
    body_match = re.search(r'"body"\s*:\s*"(.*?)"', text, re.DOTALL)
    
    subject = subj_match.group(1).replace('\\"', '"').replace('\\n', '\n') if subj_match else "Outreach opportunity"
    body = body_match.group(1).replace('\\"', '"').replace('\\n', '\n') if body_match else text
    return {"subject": subject, "body": body}

def generate_mock_email(lead_name: Optional[str], company_name: Optional[str], rating: Optional[float], provider: str) -> Dict[str, str]:
  name_val = lead_name or "Prospect"
  company_val = company_name or "your business"
  
  subject = f"Collaboration opportunity with {company_val}"
  if rating and rating >= 4.5:
    subject = f"Quick question about {company_val}'s 5-star Google review rating"
    body = (
      f"Hi {name_val},\n\n"
      f"I noticed {company_val} has a fantastic {rating}-star rating on Google Maps. "
      f"Congratulations on the stellar feedback from your clients!\n\n"
      f"I run a digital agency specializing in local operations that helps businesses convert organic local interest into automated booking pipelines.\n\n"
      f"Would you be open to a quick 5-minute call next week to see how we could help you acquire more customers monthly?\n\n"
      f"Best regards,\n[Your Name]"
    )
  else:
    body = (
      f"Hi {name_val},\n\n"
      f"I was researching active local companies in your space and came across {company_val}.\n\n"
      f"We help similar operations streamline customer acquisition channels using self-hosted platforms with zero monthly software markups.\n\n"
      f"Would you be open to a quick brainstorm session next Wednesday?\n\n"
      f"Best regards,\n[Your Name]"
    )
    
  return {
    "subject": f"[{provider.upper()} Fallback] " + subject,
    "body": f"({provider.upper()} mock fallback activated - no API key set)\n\n" + body
  }

@router.post("/generate")
async def generate_email(
  request: EmailGenerateRequest,
  current_user: dict = Depends(get_current_user),
  db: AsyncSession = Depends(get_db)
):
  # Extract lead parameters
  lead_name = request.lead_name
  company_name = request.company_name
  website = request.website
  rating = request.rating
  source = request.source

  # If lead_id is provided, lookup in database
  if request.lead_id:
    q = await db.execute(select(Lead).where(Lead.id == request.lead_id))
    lead = q.scalars().first()
    if lead:
      lead_name = lead.name
      company_name = lead.company
      website = lead.website
      rating = lead.rating
      source = lead.source

  provider_lower = request.provider.lower().strip()

  # Detect VoidAI key (explicit or auto-detected from openai/anthropic variables)
  voidai_key = None
  if settings.VOIDAI_API_KEY:
    voidai_key = settings.VOIDAI_API_KEY
  elif settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.startswith("sk-voidai"):
    voidai_key = settings.OPENAI_API_KEY
  elif settings.ANTHROPIC_API_KEY and settings.ANTHROPIC_API_KEY.startswith("sk-voidai"):
    voidai_key = settings.ANTHROPIC_API_KEY

  # 1. Fallback Mock Checks
  use_mock = False
  if not voidai_key:
    if provider_lower == "claude" and not settings.ANTHROPIC_API_KEY:
      use_mock = True
    elif provider_lower == "chatgpt" and not settings.OPENAI_API_KEY:
      use_mock = True
    elif provider_lower == "gemini" and not settings.GEMINI_API_KEY:
      use_mock = True

  if use_mock:
    return generate_mock_email(lead_name, company_name, rating, provider_lower)

  # Prepare Prompt
  instructions = request.prompt_instruction or "Keep it short, clear, and professional. Introduce ourselves and propose a brief meeting."
  prompt = (
    f"Write a personalized cold email outreach draft for the following prospect:\n"
    f"Name: {lead_name or 'Prospect'}\n"
    f"Company: {company_name or 'their company'}\n"
    f"Website: {website or 'Not Available'}\n"
    f"Rating: {f'⭐ {rating}' if rating else 'Not Available'}\n"
    f"Lead Source: {source or 'Outreach'}\n\n"
    f"User Special Instructions: {instructions}\n\n"
    f"You MUST return a JSON object with exactly two keys:\n"
    f"1. 'subject': A catchy, click-worthy email subject line targeting this lead. Do not use generic placeholders.\n"
    f"2. 'body': A short, personalized email body (under 120 words). Keep it highly natural, conversational, and professional. Do not include placeholders like [Your Name], keep the email clean.\n\n"
    f"Do NOT output any markdown tags (like ```json), notes, explanations, or backticks. Return ONLY the raw valid JSON payload."
  )

  # Execute API requests via HTTPX
  async with httpx.AsyncClient() as client:
    try:
      if voidai_key:
        headers = {
          "Authorization": f"Bearer {voidai_key}",
          "Content-Type": "application/json"
        }
        
        # Resolve model name for VoidAI
        if provider_lower == "claude":
          model = "claude-3-5-sonnet"
        elif provider_lower == "gemini":
          model = "gemini-1.5-flash"
        else: # chatgpt / default
          model = "gpt-4o"
          
        payload = {
          "model": model,
          "messages": [{"role": "user", "content": prompt}]
        }
        res = await client.post("https://api.voidai.app/v1/chat/completions", headers=headers, json=payload, timeout=20.0)
        if res.status_code != 200:
          raise Exception(res.text)
        result_text = res.json()["choices"][0]["message"]["content"]
      else:
        if provider_lower == "claude":
          headers = {
            "x-api-key": settings.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
          }
          payload = {
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 600,
            "messages": [{"role": "user", "content": prompt}]
          }
          res = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload, timeout=20.0)
          if res.status_code != 200:
            raise Exception(res.text)
          result_text = res.json()["content"][0]["text"]

        elif provider_lower == "chatgpt":
          headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json"
          }
          payload = {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}]
          }
          res = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=20.0)
          if res.status_code != 200:
            raise Exception(res.text)
          result_text = res.json()["choices"][0]["message"]["content"]

        elif provider_lower == "gemini":
          url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
          headers = {"Content-Type": "application/json"}
          payload = {
            "contents": [{"parts": [{"text": prompt}]}]
          }
          res = await client.post(url, headers=headers, json=payload, timeout=20.0)
          if res.status_code != 200:
            raise Exception(res.text)
          result_text = res.json()["candidates"][0]["content"]["parts"][0]["text"]

        else:
          raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported AI provider: {request.provider}. Choose 'claude', 'chatgpt', or 'gemini'."
          )

      parsed = clean_llm_json(result_text)
      return parsed

    except Exception as e:
      print(f"AI generation request failed: {e}")
      # Fallback to mock on connection/API failures
      return generate_mock_email(lead_name, company_name, rating, f"{provider_lower} (failed-API-fallback)")

@router.post("/spam-check")
async def check_email_spam(request: SpamCheckRequest):
  subject_lower = request.subject.lower()
  body_lower = request.body.lower()
  
  flagged_words = []
  warnings = []
  score = 0.0

  # 1. Keywords Scan
  for kw in SPAM_KEYWORDS:
    if kw in subject_lower:
      flagged_words.append(kw)
      score += 1.8
      warnings.append(f"Spam keyword '{kw.upper()}' detected in subject line.")
    if kw in body_lower:
      flagged_words.append(kw)
      score += 0.8
      # Avoid duplicate keyword warnings
      if f"Spam keyword '{kw.upper()}' detected in body." not in warnings:
        warnings.append(f"Spam keyword '{kw.upper()}' detected in body.")

  # Remove duplicate flagged words in list
  flagged_words = list(set(flagged_words))

  # 2. Exclamation marks check
  if "!" in request.subject:
    score += 1.0
    warnings.append("Avoid exclamation marks in the subject line to prevent spam classification.")
  
  excl_count = request.body.count("!")
  if excl_count > 3:
    score += 1.2
    warnings.append(f"Excessive exclamation marks ({excl_count}) in body text.")

  # 3. Capitalization check
  caps_in_subject = len(re.findall(r"\b[A-Z]{3,}\b", request.subject))
  if caps_in_subject > 0:
    score += 1.5
    warnings.append("Subject contains all-caps words. This frequently triggers spam filters.")

  # Cap score at 10.0
  score = round(min(10.0, score), 1)
  
  is_spam = score >= 5.0
  recommendation = "Safe to send."
  if score >= 7.0:
    recommendation = "High risk of being flagged as spam. Rework copy to remove promotional language and capitalizations."
  elif score >= 4.0:
    recommendation = "Moderate risk. Remove highlighted spam triggers to improve deliverability."

  return {
    "spam_score": score,
    "is_spam": is_spam,
    "flagged_words": flagged_words,
    "warnings": warnings,
    "recommendation": recommendation
  }
