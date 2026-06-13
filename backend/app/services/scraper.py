import re
import httpx
import random
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from typing import List, Dict, Optional
from app.config import settings

# Regex to detect emails
EMAIL_REGEX = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')

# Email filter to exclude generic placeholders or files
JUNK_KEYWORDS = [
    "noreply", "no-reply", "example", "domain.com", "wixpress", 
    "sentry.io", "bootstrap", "font", "license", "gravatar", 
    "yourdomain", "companyname"
]
JUNK_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".css", ".js", ".webp", ".ico"]

def is_valid_email(email: str) -> bool:
    email = email.lower().strip()
    if not EMAIL_REGEX.match(email):
        return False
    # Check junk words
    for kw in JUNK_KEYWORDS:
        if kw in email:
            return False
    # Check if ends with file extensions
    for ext in JUNK_EXTENSIONS:
        if email.endswith(ext):
            return False
    return True

async def extract_emails_from_html(html: str) -> List[str]:
    emails = EMAIL_REGEX.findall(html)
    unique_valid_emails = list(set([email for email in emails if is_valid_email(email)]))
    return unique_valid_emails

async def crawl_website_for_email(url: str) -> Optional[str]:
    if not url:
        return None
    if not url.startswith("http"):
        url = "http://" + url
        
    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}) as client:
        try:
            # 1. Fetch homepage
            response = await client.get(url, timeout=5.0, follow_redirects=True)
            if response.status_code != 200:
                return None
                
            html = response.text
            emails = await extract_emails_from_html(html)
            if emails:
                return emails[0]
                
            # 2. Look for contact page links if homepage didn't have email
            soup = BeautifulSoup(html, "html.parser")
            contact_links = []
            
            # Helper to check if a link looks like contact page
            for a in soup.find_all("a", href=True):
                href = a["href"].lower()
                text = a.get_text().lower()
                if any(k in href or k in text for k in ["contact", "about", "info", "touch", "email"]):
                    full_url = urljoin(url, a["href"])
                    # Ensure same domain
                    if urlparse(full_url).netloc == urlparse(url).netloc:
                        contact_links.append(full_url)
            
            # Remove duplicate links and query up to 2 contact pages
            contact_links = list(set(contact_links))
            for contact_url in contact_links[:2]:
                try:
                    res = await client.get(contact_url, timeout=5.0, follow_redirects=True)
                    if res.status_code == 200:
                        contact_emails = await extract_emails_from_html(res.text)
                        if contact_emails:
                            return contact_emails[0]
                except Exception:
                    continue
                    
        except Exception as e:
            print(f"Error crawling {url}: {e}")
            
    return None

# ==========================================
# Google Maps Scraper
# ==========================================

async def scrape_google_maps_leads(
    keyword: str, 
    max_results: int, 
    extract_emails: bool = True
) -> List[Dict]:
    leads = []
    
    if not settings.GOOGLE_MAPS_API_KEY:
        raise ValueError("Google Maps API Key is not configured.")
        
    # REAL Google Places API Call
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    params = {
        "query": keyword,
        "key": settings.GOOGLE_MAPS_API_KEY
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                results = data.get("results", [])[:max_results]
                
                for place in results:
                    name = place.get("name")
                    address = place.get("formatted_address")
                    rating = place.get("rating", 0.0)
                    
                    # Google Place Details API call to get phone & website URL
                    place_id = place.get("place_id")
                    website = ""
                    phone = ""
                    
                    if place_id:
                        details_url = "https://maps.googleapis.com/maps/api/place/details/json"
                        details_params = {
                            "place_id": place_id,
                            "fields": "formatted_phone_number,website",
                            "key": settings.GOOGLE_MAPS_API_KEY
                        }
                        det_res = await client.get(details_url, params=details_params)
                        if det_res.status_code == 200:
                            det_data = det_res.json().get("result", {})
                            website = det_data.get("website", "")
                            phone = det_data.get("formatted_phone_number", "")
                    
                    email = ""
                    if extract_emails and website:
                        email = await crawl_website_for_email(website) or ""
                        
                    leads.append({
                        "name": name,
                        "email": email,
                        "company": name,
                        "phone": phone,
                        "website": website,
                        "address": address,
                        "rating": rating,
                        "source": "google_maps",
                        "score": 8.0 if email else 3.0
                    })
        except Exception as e:
            print(f"Error in Google Places API: {e}")
            raise e
            
    return leads


# ==========================================
# Facebook Ads Library Scraper
# ==========================================

async def scrape_facebook_ads_leads(
    keyword: str, 
    country: str, 
    max_results: int, 
    extract_emails: bool = True
) -> List[Dict]:
    leads = []
    
    if not settings.META_ACCESS_TOKEN:
        raise ValueError("Meta Access Token is not configured.")
        
    # REAL Meta Graph Ads Archive API Call
    url = "https://graph.facebook.com/v19.0/ads_archive"
    params = {
        "ad_search_keyword": keyword,
        "ad_reached_countries": f"['{country}']",
        "ad_active_status": "ACTIVE",
        "fields": "page_id,page_name,ad_creative_link_titles,ad_creative_link_captions",
        "limit": max_results,
        "access_token": settings.META_ACCESS_TOKEN
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                results = data.get("data", [])
                
                # Track unique pages (advertisers) to prevent duplicate leads in single scrape
                seen_pages = set()
                
                for ad in results:
                    page_id = ad.get("page_id")
                    page_name = ad.get("page_name")
                    
                    if page_id in seen_pages:
                        continue
                    seen_pages.add(page_id)
                    
                    # Find link captions to guess website
                    website = ""
                    captions = ad.get("ad_creative_link_captions", [])
                    for cap in captions:
                        if cap and ("." in cap) and not cap.endswith(("facebook.com", "instagram.com")):
                            website = cap
                            if not website.startswith("http"):
                                website = "https://" + website
                            break
                    
                    email = ""
                    if extract_emails and website:
                        email = await crawl_website_for_email(website) or ""
                        
                    leads.append({
                        "name": page_name,
                        "email": email,
                        "company": page_name,
                        "phone": "",
                        "website": website,
                        "address": "",
                        "rating": 0.0,
                        "source": "facebook_ads",
                        "score": 9.0 if email else 4.0  # Facebook Ads indicate higher active commercial intent
                    })
                    
                    if len(leads) >= max_results:
                        break
        except Exception as e:
            print(f"Error in Meta Ads API: {e}")
            raise e
            
    return leads
