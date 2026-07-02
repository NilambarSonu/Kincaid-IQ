from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True, pool_size=5, max_overflow=10)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _col_exists(conn, table: str, column: str) -> bool:
    result = conn.execute(text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column})
    return result.fetchone() is not None


def _run_migrations(conn):
    new_columns = [
        ("email", "VARCHAR"),
        ("oauth_provider", "VARCHAR"),
        ("oauth_sub", "VARCHAR"),
        ("full_name", "VARCHAR"),
        ("avatar_url", "VARCHAR"),
        ("created_at", "TIMESTAMP DEFAULT NOW()"),
    ]
    existing = set()
    result = conn.execute(text(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
    ))
    for row in result:
        existing.add(row[0])

    for col_name, col_type in new_columns:
        if col_name not in existing:
            conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))

    # Add user_id to ai_output_history if the table already exists without it
    if not _col_exists(conn, "ai_output_history", "user_id"):
        try:
            conn.execute(text(
                "ALTER TABLE ai_output_history ADD COLUMN IF NOT EXISTS "
                "user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE"
            ))
        except Exception:
            pass

    # Add bcc_count to client_package_deliveries (Task #86) — count only,
    # no addresses, so compliance can prove a hidden inbox was looped in.
    if not _col_exists(conn, "client_package_deliveries", "bcc_count"):
        try:
            conn.execute(text(
                "ALTER TABLE client_package_deliveries "
                "ADD COLUMN IF NOT EXISTS bcc_count INTEGER DEFAULT 0"
            ))
        except Exception:
            pass

    # Add `source` to client_package_deliveries (Task #104) so we can tell
    # broker-initiated sends apart from scheduled compliance auto-emails in
    # the Recent deliveries audit log.
    if not _col_exists(conn, "client_package_deliveries", "source"):
        try:
            conn.execute(text(
                "ALTER TABLE client_package_deliveries "
                "ADD COLUMN IF NOT EXISTS source VARCHAR NOT NULL DEFAULT 'manual'"
            ))
        except Exception:
            pass

    # Add `body_markdown` to client_package_deliveries so emailed diffs can be
    # re-fired straight from the delivery log (resend re-sends the stored body).
    if not _col_exists(conn, "client_package_deliveries", "body_markdown"):
        try:
            conn.execute(text(
                "ALTER TABLE client_package_deliveries "
                "ADD COLUMN IF NOT EXISTS body_markdown TEXT"
            ))
        except Exception:
            pass

    # Add IANA timezone to delivery-log auto-email schedule (Task #103) so
    # brokers can specify "every Monday at 9am" in their local zone instead
    # of doing UTC math. DST shifts roll forward/back automatically.
    if not _col_exists(conn, "client_package_delivery_schedules", "timezone"):
        try:
            conn.execute(text(
                "ALTER TABLE client_package_delivery_schedules "
                "ADD COLUMN IF NOT EXISTS timezone VARCHAR NOT NULL DEFAULT 'UTC'"
            ))
        except Exception:
            pass

    # Add owner + response_deadline to rfp_opportunities for the board workflow.
    for col, col_type in [("owner", "VARCHAR"), ("response_deadline", "VARCHAR")]:
        if not _col_exists(conn, "rfp_opportunities", col):
            try:
                conn.execute(text(
                    f"ALTER TABLE rfp_opportunities ADD COLUMN IF NOT EXISTS {col} {col_type}"
                ))
            except Exception:
                pass

    # Add 5500 benchmark linkage fields to rfp_opportunities
    for col, col_type in [("ein", "VARCHAR"), ("benchmark_snapshot", "TEXT")]:
        if not _col_exists(conn, "rfp_opportunities", col):
            try:
                conn.execute(text(
                    f"ALTER TABLE rfp_opportunities ADD COLUMN IF NOT EXISTS {col} {col_type}"
                ))
            except Exception:
                pass

    # Opportunity Scoring Engine columns for rfp_opportunities (Task #152)
    _rfp_scoring_cols = [
        ("opportunity_score",  "DOUBLE PRECISION"),
        ("score_tier",         "VARCHAR"),
        ("score_breakdown",    "TEXT"),
        ("score_factors",      "TEXT"),
        ("score_confidence",   "VARCHAR"),
        ("scored_at",          "TIMESTAMP"),
    ]
    for col, col_type in _rfp_scoring_cols:
        if not _col_exists(conn, "rfp_opportunities", col):
            try:
                conn.execute(text(
                    f"ALTER TABLE rfp_opportunities ADD COLUMN IF NOT EXISTS {col} {col_type}"
                ))
            except Exception:
                pass

    # Battlecards — known_competitor on rfp_opportunities for pre-decision tagging (Task #159)
    if not _col_exists(conn, "rfp_opportunities", "known_competitor"):
        try:
            conn.execute(text(
                "ALTER TABLE rfp_opportunities ADD COLUMN IF NOT EXISTS known_competitor VARCHAR"
            ))
        except Exception:
            pass

    # Win/Loss Intelligence — structured debrief columns on rfp_win_loss (Task #153)
    _rfp_win_loss_cols = [
        ("pricing_factor",           "BOOLEAN"),
        ("relationship_factor",      "BOOLEAN"),
        ("product_gaps",             "TEXT"),
        ("procurement_observations", "TEXT"),
        ("lessons_learned",          "TEXT"),
        ("monitoring_enrolled",      "BOOLEAN DEFAULT FALSE"),
        ("contract_value",           "DOUBLE PRECISION"),
    ]
    for col, col_type in _rfp_win_loss_cols:
        if not _col_exists(conn, "rfp_win_loss", col):
            try:
                conn.execute(text(
                    f"ALTER TABLE rfp_win_loss ADD COLUMN IF NOT EXISTS {col} {col_type}"
                ))
            except Exception:
                pass

    # ROI / Outcome Economics columns on rfp_win_loss (Task #166)
    _rfp_roi_cols = [
        ("realized_revenue",  "DOUBLE PRECISION"),
        ("pursuit_hours",     "DOUBLE PRECISION"),
        ("pursuit_cost_usd",  "DOUBLE PRECISION"),
        ("hourly_rate_usd",   "DOUBLE PRECISION"),
    ]
    for col, col_type in _rfp_roi_cols:
        if not _col_exists(conn, "rfp_win_loss", col):
            try:
                conn.execute(text(
                    f"ALTER TABLE rfp_win_loss ADD COLUMN IF NOT EXISTS {col} {col_type}"
                ))
            except Exception:
                pass

    conn.commit()


def _migrate_claims_schema(conn):
    """
    Drop the claims table when the old schema is detected (verification_state column present).
    SQLAlchemy create_all will recreate it with the canonical schema.
    """
    if _col_exists(conn, "claims", "verification_state"):
        conn.execute(text("DROP TABLE IF EXISTS claims CASCADE"))
        conn.commit()


def _migrate_sales_pipeline_schema(conn):
    """
    Reconcile the legacy sales_pipeline schema with the current SalesPipeline model.

    The old table used renamed columns (ein, sponsor_name, owner_id, est_premium,
    employees, score) that no longer match the model and cause UndefinedColumn 500s
    on /api/sales-os/analytics and /kanban. Detected via the legacy `sponsor_name`
    column. Renames preserve any existing rows; new columns are added so
    create_all() finds the canonical schema intact.
    """
    if not _col_exists(conn, "sales_pipeline", "sponsor_name"):
        return

    renames = [
        ("ein", "employer_ein"),
        ("sponsor_name", "employer_name"),
        ("owner_id", "added_by"),
        ("est_premium", "welfare_premiums"),
        ("employees", "participants"),
        ("score", "opportunity_score"),
    ]
    for old, new in renames:
        if _col_exists(conn, "sales_pipeline", old) and not _col_exists(conn, "sales_pipeline", new):
            conn.execute(text(f"ALTER TABLE sales_pipeline RENAME COLUMN {old} TO {new}"))

    added = [
        ("org_id", "VARCHAR"),
        ("city", "VARCHAR"),
        ("broker_commissions", "DOUBLE PRECISION"),
        ("opportunity_tier", "VARCHAR"),
    ]
    for col, col_type in added:
        conn.execute(text(f"ALTER TABLE sales_pipeline ADD COLUMN IF NOT EXISTS {col} {col_type}"))
    conn.commit()


def create_tables():
    with engine.connect() as conn:
        _migrate_claims_schema(conn)
        _migrate_sales_pipeline_schema(conn)
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        _run_migrations(conn)
