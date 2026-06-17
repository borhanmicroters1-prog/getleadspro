import time
import random
import logging
from collections import defaultdict
from fastapi import Request, HTTPException, status

logger = logging.getLogger("rate_limiter")

class InMemoryRateLimiter:
    def __init__(self, requests_limit: int, window_seconds: int, name: str = "Limiter"):
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        self.name = name
        # Maps client IP to list of request timestamps
        self.history = defaultdict(list)

    def is_allowed(self, client_ip: str) -> bool:
        now = time.time()
        
        # Periodically prune history to prevent memory leaks (approx 1% of requests)
        if random.random() < 0.01:
            self._prune()

        # Clean up client's own history
        self.history[client_ip] = [
            t for t in self.history[client_ip]
            if now - t < self.window_seconds
        ]
        
        if len(self.history[client_ip]) < self.requests_limit:
            self.history[client_ip].append(now)
            return True
            
        logger.warning(f"Rate limit exceeded for {self.name} on IP: {client_ip}. Limit: {self.requests_limit}/{self.window_seconds}s")
        return False

    def _prune(self):
        now = time.time()
        for ip in list(self.history.keys()):
            self.history[ip] = [
                t for t in self.history[ip]
                if now - t < self.window_seconds
            ]
            if not self.history[ip]:
                del self.history[ip]

# Instantiate rate limiters
# Unsubscribe: 10 requests per minute per IP
unsubscribe_limiter = InMemoryRateLimiter(requests_limit=10, window_seconds=60, name="Unsubscribe")
# Open Tracking: 100 requests per minute per IP
open_tracking_limiter = InMemoryRateLimiter(requests_limit=100, window_seconds=60, name="Open Tracking")

async def rate_limit_unsubscribe(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
        
    if not unsubscribe_limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many unsubscribe requests. Please try again later."
        )

async def rate_limit_open_tracking(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
        
    if not open_tracking_limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many tracking requests."
        )
