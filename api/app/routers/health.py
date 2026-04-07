from fastapi import APIRouter

router = APIRouter()


@router.get("/", tags=["health"])
def health_check() -> dict[str, str]:
    """Health check endpoint.

    Returns:
        dict: Status message indicating the API is up.
    """
    return {"message": "Inkwell REST API server is up"}
