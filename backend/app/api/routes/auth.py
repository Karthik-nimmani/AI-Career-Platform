"""
Authentication routes for FastAPI using Supabase Auth.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.db.supabase_client import supabase
from app.models.auth import UserRegister, UserLogin, UserResponse, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Dependency to validate the Bearer token passed in the request header
    against Supabase Auth and return the user object.
    """
    token = credentials.credentials
    try:
        # Validate the token directly with Supabase Auth
        res = supabase.auth.get_user(token)
        if not res or not res.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token",
            )
        return res.user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
        )


@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    """
    Register a new user using email and password.
    """
    try:
        res = supabase.auth.sign_up({
            "email": user_data.email,
            "password": user_data.password,
            "options": {
                "data": {
                    "full_name": user_data.full_name
                }
            }
        })
        
        if not res.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="User registration failed"
            )

        # If email confirmation is enabled, session will be None.
        if not res.session:
            # Let's raise a 202 status code so the client knows it was successful, 
            # but needs email confirmation. Since response_model is TokenResponse, 
            # we should raise an HTTP exception or return a mock token for easier dev.
            # Let's handle it by raising a detailed error or returning an empty structure.
            raise HTTPException(
                status_code=status.HTTP_202_ACCEPTED,
                detail="Registration successful! Please confirm your email address before logging in."
            )

        return TokenResponse(
            access_token=res.session.access_token,
            refresh_token=res.session.refresh_token,
            token_type="bearer",
            user=UserResponse(
                id=res.user.id,
                email=res.user.email,
                full_name=res.user.user_metadata.get("full_name") or user_data.full_name,
                created_at=res.user.created_at
            )
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """
    Log in a user using email and password.
    """
    try:
        res = supabase.auth.sign_in_with_password({
            "email": credentials.email,
            "password": credentials.password
        })

        if not res.session or not res.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        return TokenResponse(
            access_token=res.session.access_token,
            refresh_token=res.session.refresh_token,
            token_type="bearer",
            user=UserResponse(
                id=res.user.id,
                email=res.user.email,
                full_name=res.user.user_metadata.get("full_name"),
                created_at=res.user.created_at
            )
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Login failed: {str(e)}"
        )


@router.post("/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Sign out user by calling Supabase Auth sign out.
    """
    token = credentials.credentials
    try:
        # Note: supabase-py doesn't have a direct token-based sign_out method on the client instance 
        # unless client is initialized with that token. However, standard client auth sign_out invalidates 
        # the current session.
        # For simplicity and robustness, we can call sign_out on the admin/standard client.
        supabase.auth.sign_out()
        return {"detail": "Successfully logged out"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Logout failed: {str(e)}"
        )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user=Depends(get_current_user)):
    """
    Get the profile details of the currently authenticated user.
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.user_metadata.get("full_name"),
        created_at=current_user.created_at
    )
