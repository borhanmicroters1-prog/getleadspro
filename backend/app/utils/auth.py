import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings
from jwt import PyJWKClient

security = HTTPBearer()

jwk_client = None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    global jwk_client
    token = credentials.credentials
    


    try:
        if settings.SUPABASE_PROJECT_ID:
            if not jwk_client:
                jwks_url = f"https://{settings.SUPABASE_PROJECT_ID}.supabase.co/auth/v1/.well-known/jwks.json"
                jwk_client = PyJWKClient(jwks_url)
            
            try:
                signing_key = jwk_client.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256", "ES256", "HS256"],
                    options={"verify_aud": False}
                )
            except jwt.ExpiredSignatureError:
                raise
            except Exception as jwks_err:
                # Fallback to local JWT validation if JWKS lookup fails
                payload = jwt.decode(
                    token,
                    settings.SUPABASE_JWT_SECRET,
                    algorithms=["RS256", "ES256", "HS256"],
                    options={"verify_aud": False}
                )
        else:
            # Decode the token using Supabase JWT Secret
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
        
        # Verify that sub (user_id) is present
        user_id = payload.get("sub")
        email = payload.get("email")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: missing subject (sub)"
            )
            
        return {
            "id": user_id,
            "email": email or "",
            "name": payload.get("user_metadata", {}).get("name", ""),
            "avatar": payload.get("user_metadata", {}).get("avatar_url", ""),
            "payload": payload
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )
