import re
import socket
import smtplib
import random
import string
import dns.resolver

# Common disposable domains
DISPOSABLE_DOMAINS = {
    "mailinator.com", "yopmail.com", "tempmail.com", "guerrillamail.com", 
    "10minutemail.com", "getairmail.com", "sharklasers.com", "mailnesia.com", 
    "maildrop.cc", "dispostable.com", "tempmailaddress.com", "boun.cr", 
    "crazymailing.com", "throwawaymail.com", "temp-mail.org", "owlymail.com", 
    "generator.email", "fakemailgenerator.com", "mailcatching.com", "tempmail.net",
    "trashmail.com", "getnada.com", "tempmail.dev", "guerrillamailblock.com",
    "guerrillamail.net", "guerrillamail.org", "guerrillamail.biz", "grr.la"
}

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

def verify_email_syntax(email: str) -> bool:
    return bool(EMAIL_REGEX.match(email))

def is_disposable_email(email: str) -> bool:
    try:
        domain = email.split("@")[1].strip().lower()
        return domain in DISPOSABLE_DOMAINS
    except Exception:
        return False

def generate_random_mailbox(domain: str) -> str:
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=15))
    return f"check-{random_str}@{domain}"

async def verify_email_dns_and_smtp(email: str, sender: str = "verify@getleads.co") -> tuple[str, str | None]:
    """
    Verifies an email address using DNS MX lookup and SMTP handshake.
    Returns (status, error_message).
    Statuses: 'valid', 'invalid', 'catch_all', 'unknown', 'disposable'
    """
    email = email.strip()
    if not email:
        return "invalid", "Email is empty"

    if not verify_email_syntax(email):
        return "invalid", "Invalid email format"
        
    if is_disposable_email(email):
        return "disposable", "Disposable email address detected"

    try:
        domain = email.split("@")[1].strip().lower()
    except Exception:
        return "invalid", "Could not parse domain from email"
    
    # 1. DNS MX Records check
    mx_hosts = []
    try:
        answers = dns.resolver.resolve(domain, 'MX')
        sorted_answers = sorted(answers, key=lambda r: r.preference)
        for rdata in sorted_answers:
            mx_hosts.append(str(rdata.exchange).rstrip('.'))
    except Exception as e:
        # Check A record as fallback (some mail domains host on primary A record)
        try:
            dns.resolver.resolve(domain, 'A')
            mx_hosts.append(domain)
        except Exception:
            return "invalid", f"No MX or A records found: {str(e)}"
            
    if not mx_hosts:
        return "invalid", "No mail servers found for domain"

    # 2. SMTP Handshake check (best effort)
    mx_host = mx_hosts[0]
    
    try:
        # Connect to the MX server
        server = smtplib.SMTP(timeout=4)
        server.connect(mx_host, 25)
        
        # Helo and Sender
        server.helo(socket.gethostname())
        server.mail(sender)
        
        # Check catch-all first using a random non-existent mailbox
        random_mailbox = generate_random_mailbox(domain)
        code_catch, _ = server.rcpt(random_mailbox)
        
        is_catch_all = (code_catch == 250)
        
        # Check the actual email recipient
        code, message = server.rcpt(email)
        server.quit()
        
        # Decode error message
        decoded_msg = message.decode(errors='ignore') if isinstance(message, bytes) else str(message)
        
        if is_catch_all:
            return "catch_all", "Domain is catch-all (accepts all addresses)"
            
        if code == 250:
            return "valid", None
        elif code in (251, 252):
            return "valid", f"Forwarded/accepted: {code} {decoded_msg}"
        elif code >= 500:
            return "invalid", f"Mailbox unavailable ({code}): {decoded_msg}"
        else:
            return "unknown", f"Unexpected code {code}: {decoded_msg}"
            
    except (socket.timeout, socket.error) as se:
        # Connection failed or timed out. Usually because outbound Port 25 is blocked.
        # Since MX/A records exist, we mark as 'unknown' rather than 'invalid'
        # so the user knows we couldn't ping the mailbox, but it might still be valid.
        return "unknown", f"SMTP connection failed (Port 25 block or server timeout): {str(se)}"
    except Exception as e:
        return "unknown", f"Verification error: {str(e)}"
