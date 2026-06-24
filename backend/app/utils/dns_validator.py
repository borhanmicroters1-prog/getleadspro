import dns.resolver
import logging

logger = logging.getLogger("dns_validator")

def get_txt_records(domain: str) -> list:
    try:
        resolver = dns.resolver.Resolver()
        resolver.timeout = 5.0
        resolver.lifetime = 5.0
        answers = resolver.resolve(domain, 'TXT')
        records = []
        for rdata in answers:
            # Join multiple TXT segments if they are split
            txt_content = "".join([part.decode('utf-8') if isinstance(part, bytes) else part for part in rdata.strings])
            records.append(txt_content)
        return records
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.NoNameservers) as e:
        logger.warning(f"No TXT records found or domain error for {domain}: {e}")
        return []
    except Exception as e:
        logger.error(f"Error querying TXT records for {domain}: {e}")
        return []

def verify_domain_dns(domain: str, provider: str = None) -> dict:
    """
    Checks SPF, DKIM, and DMARC for a domain.
    """
    domain = domain.strip().lower()
    if "@" in domain:
        domain = domain.split("@")[-1]
        
    provider = (provider or "").strip().lower()
    
    # 1. Verify SPF
    spf_records = []
    spf_status = "fail"
    spf_value = None
    domain_txts = get_txt_records(domain)
    for record in domain_txts:
        if record.startswith("v=spf1") or "v=spf1" in record:
            spf_records.append(record)
            
    if spf_records:
        spf_status = "pass"
        spf_value = spf_records[0] # Take first match
        
    # 2. Verify DKIM
    dkim_status = "fail"
    dkim_value = None
    dkim_selector = None
    
    # We check standard selectors based on provider
    selectors = []
    if provider == "gmail":
        selectors = ["google"]
    elif provider == "brevo":
        selectors = ["mail"]
    else:
        # Check a few common ones
        selectors = ["google", "mail", "k1", "default", "smtp"]
        
    for selector in selectors:
        dkim_domain = f"{selector}._domainkey.{domain}"
        dkim_txts = get_txt_records(dkim_domain)
        for record in dkim_txts:
            # Check if record looks like a DKIM record
            if "v=DKIM1" in record or "p=" in record:
                dkim_status = "pass"
                dkim_value = record
                dkim_selector = selector
                break
        if dkim_status == "pass":
            break
            
    # 3. Verify DMARC
    dmarc_status = "fail"
    dmarc_value = None
    dmarc_domain = f"_dmarc.{domain}"
    dmarc_txts = get_txt_records(dmarc_domain)
    for record in dmarc_txts:
        if record.startswith("v=DMARC1") or "v=DMARC1" in record:
            dmarc_status = "pass"
            dmarc_value = record
            break
            
    # Generate recommendations
    recommendations = []
    if spf_status == "fail":
        if provider == "gmail":
            recommendations.append("Add SPF TXT record: v=spf1 include:_spf.google.com ~all")
        elif provider == "brevo":
            recommendations.append("Add SPF TXT record: v=spf1 include:spf.sendinblue.com ~all")
        else:
            recommendations.append("Add a valid SPF TXT record (v=spf1 ...) to authorize this sending IP/provider.")
            
    if dkim_status == "fail":
        if provider == "gmail":
            recommendations.append("Set up Google DKIM key in Google Workspace Admin Console and add the TXT record at google._domainkey")
        elif provider == "brevo":
            recommendations.append("Add DKIM TXT record at mail._domainkey with the key provided in your Brevo dashboard")
        else:
            recommendations.append("Configure and add a DKIM TXT key for selector._domainkey on your domain.")
            
    if dmarc_status == "fail":
        recommendations.append(f"Add DMARC TXT record at _dmarc.{domain}: v=DMARC1; p=none; rua=mailto:dmarc-reports@{domain}")

    # Calculate overall health score
    passed_count = sum([1 for x in [spf_status, dkim_status, dmarc_status] if x == "pass"])
    overall_score = round((passed_count / 3) * 100)

    # Return structure
    return {
        "domain": domain,
        "spf": {
            "status": spf_status,
            "record": spf_value,
            "info": "SPF (Sender Policy Framework) allows you to specify which mail servers are authorized to send email on behalf of your domain."
        },
        "dkim": {
            "status": dkim_status,
            "record": dkim_value,
            "selector": dkim_selector,
            "info": "DKIM (DomainKeys Identified Mail) adds a cryptographic signature to your emails, verifying that they were actually sent by the domain owner."
        },
        "dmarc": {
            "status": dmarc_status,
            "record": dmarc_value,
            "info": "DMARC (Domain-based Message Authentication, Reporting, and Conformance) tells receiving servers how to handle emails that fail SPF or DKIM checks."
        },
        "recommendations": recommendations,
        "overall_score": overall_score
    }
