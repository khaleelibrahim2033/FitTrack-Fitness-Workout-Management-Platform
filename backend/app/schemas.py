from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class WorkoutCategory(str, Enum):
    cardio = "Cardio"
    strength = "Strength"
    yoga = "Yoga"


class GoalType(str, Enum):
    weight_loss = "Weight Loss"
    muscle_gain = "Muscle Gain"
    steps = "Steps"


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=40, pattern=r"^[a-zA-Z0-9_.-]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be no more than 72 UTF-8 bytes")
        return value


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class WorkoutCreate(BaseModel):
    workout_name: str = Field(min_length=2, max_length=100)
    category: WorkoutCategory
    duration: int = Field(gt=0, le=1440)
    calories_burned: int = Field(ge=0, le=10000)
    workout_date: date


class WorkoutUpdate(BaseModel):
    workout_name: str | None = Field(default=None, min_length=2, max_length=100)
    category: WorkoutCategory | None = None
    duration: int | None = Field(default=None, gt=0, le=1440)
    calories_burned: int | None = Field(default=None, ge=0, le=10000)
    workout_date: date | None = None


class WorkoutResponse(WorkoutCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime


class ProgressDay(BaseModel):
    date: date
    total_workouts: int
    total_calories: int
    total_duration: int


class GoalCreate(BaseModel):
    goal_type: GoalType
    target_value: float = Field(gt=0, le=1_000_000_000)
    current_value: float = Field(default=0, ge=0, le=1_000_000_000)
    deadline: date


class GoalUpdate(BaseModel):
    current_value: float = Field(ge=0, le=1_000_000_000)


class GoalResponse(GoalCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    status: str


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    message: str
    is_read: bool
    created_at: datetime


class ReportSummary(BaseModel):
    start_date: date
    end_date: date
    total_workouts: int
    total_calories: int
    total_duration: int
    days: list[ProgressDay]
