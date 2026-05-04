from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from db import Base

class WorkItem(Base):
    __tablename__ = "work_items"

    id = Column(Integer, primary_key=True, index=True)
    component_id = Column(String, index=True)
    status = Column(String, default="OPEN")  # OPEN, INVESTIGATING, RESOLVED, CLOSED
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    rca = Column(String, nullable=True)