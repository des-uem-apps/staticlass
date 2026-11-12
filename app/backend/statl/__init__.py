import os
from datetime import timedelta
from flask import Flask, jsonify, request as req_flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_login import LoginManager
from flask_mail import Mail
from sqlalchemy import text
from dotenv import load_dotenv
from .config import Config

db           = SQLAlchemy()
mail         = Mail()
login_manager = LoginManager()

_PASTA_UPLOADS = os.path.normpath(
    os.path.join(os.path.abspath(os.path.dirname(__file__)), '..', '..', 'uploads')
)
os.makedirs(_PASTA_UPLOADS, exist_ok=True)


def create_app(testing: bool = False):
    load_dotenv()
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(Config)

    _configurar_banco(app, testing)

    app.config['UPLOAD_FOLDER']               = _PASTA_UPLOADS
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    if not testing:
        app.secret_key             = os.getenv("FLASK_SECRET_KEY", os.getenv("SECRET_KEY"))
        app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", os.getenv("SECRET_KEY"))
        app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=12)

    _configurar_cors(app)

    JWTManager(app)
    login_manager.init_app(app)
    mail.init_app(app)
    db.init_app(app)

    _registrar_blueprints(app)

    with app.app_context():
        from .models import user, chapters, quiz_resultado, questao_diaria  # noqa: F401
        from .models import questions as _modelos_questao                   # noqa: F401
        from .models.questions import QuestionProposal                      # noqa: F401
        from .models import turmas as _modelos_turmas                       # noqa: F401
        from .models import listas as _modelos_listas                       # noqa: F401
        from .models import answer_history as _modelos_answer_history       # noqa: F401
        db.create_all()
        _garantir_schema_incremental(app)
        from .repositories.answer_history_repository import backfill_list_answer_history
        try:
            backfill_list_answer_history()
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise

    return app


def _configurar_banco(app, testing):
    if testing:
        from sqlalchemy.pool import StaticPool
        app.config.update(
            TESTING=True,
            WTF_CSRF_ENABLED=False,
            LOGIN_DISABLED=True,
            SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
            SQLALCHEMY_ENGINE_OPTIONS={
                "connect_args": {"check_same_thread": False},
                "poolclass": StaticPool,
            },
            SECRET_KEY="test-secret-key",
            JWT_SECRET_KEY="test-jwt-secret-key",
        )
        return

    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL não definida.")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    app.config["SQLALCHEMY_DATABASE_URI"] = url


def _configurar_cors(app):
    origens = os.getenv("CORS_ORIGINS", "*")
    lista_origens = [o.strip() for o in origens.split(",")] if origens != "*" else "*"
    CORS(app, origins=lista_origens)

    @app.before_request
    def tratar_preflight():
        if req_flask.method == 'OPTIONS':
            res = jsonify({})
            res.headers.update({
                'Access-Control-Allow-Origin':  '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
            })
            return res, 200

    @app.after_request
    def adicionar_cabecalhos_cors(response):
        response.headers.update({
            'Access-Control-Allow-Origin':  '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        })
        return response


def _registrar_blueprints(app):
    from .routes import admin, auth, gamification, lists, questions, users, turmas, classroom
    for blueprint in (auth.bp, questions.bp, users.bp, admin.bp, gamification.bp, lists.bp, turmas.bp, classroom.bp):
        app.register_blueprint(blueprint)


def _deduplicar_alternativas_legadas():
    db.session.execute(text("""
        DELETE FROM alternatives a
        USING (
            SELECT id
            FROM (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY question_id, letter
                        ORDER BY id
                    ) AS row_num
                FROM alternatives
            ) ranked
            WHERE ranked.row_num > 1
        ) duplicates
        WHERE a.id = duplicates.id
    """))


def _desambiguar_original_ids_duplicados():
    db.session.execute(text("""
        UPDATE questions q
        SET original_id = CONCAT(q.original_id, '__legacy_', q.id)
        FROM (
            SELECT id
            FROM (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY original_id
                        ORDER BY id
                    ) AS row_num
                FROM questions
                WHERE original_id IS NOT NULL
            ) ranked
            WHERE ranked.row_num > 1
        ) duplicates
        WHERE q.id = duplicates.id
    """))


def _garantir_constraints_questions():
    # The import scripts historically relied on application-layer checks only.
    # Harden the live schema before adding DB-level constraints.
    _deduplicar_alternativas_legadas()
    _desambiguar_original_ids_duplicados()
    db.session.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'uq_alternative_question_letter'
            ) THEN
                ALTER TABLE alternatives
                ADD CONSTRAINT uq_alternative_question_letter
                UNIQUE (question_id, letter);
            END IF;
        END $$;
    """))
    db.session.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'uq_questions_original_id'
            ) THEN
                ALTER TABLE questions
                ADD CONSTRAINT uq_questions_original_id
                UNIQUE (original_id);
            END IF;
        END $$;
    """))


def _garantir_schema_incremental(app):
    if db.engine.dialect.name != "postgresql":
        return

    try:
        _garantir_constraints_questions()
        db.session.execute(
            text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS source VARCHAR(20)")
        )
        db.session.execute(
            text("""
                ALTER TABLE questions
                ADD COLUMN IF NOT EXISTS professor_id INTEGER REFERENCES users(id) ON DELETE SET NULL
            """)
        )
        db.session.execute(
            text("CREATE INDEX IF NOT EXISTS idx_questions_professor_id ON questions (professor_id)")
        )
        db.session.execute(
            text("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'users' AND column_name = 'score'
                    ) THEN
                        ALTER TABLE users RENAME COLUMN score TO xp;
                    END IF;
                END $$;
            """)
        )
        db.session.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0")
        )
        db.session.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS streak INTEGER NOT NULL DEFAULT 0")
        )
        db.session.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_practice_date DATE")
        )
        # Garante defaults nas colunas users que podem ter sido criadas sem server_default
        db.session.execute(
            text("ALTER TABLE users ALTER COLUMN active SET DEFAULT TRUE")
        )
        db.session.execute(
            text("ALTER TABLE users ALTER COLUMN xp SET DEFAULT 0")
        )
        db.session.execute(
            text("ALTER TABLE users ALTER COLUMN streak SET DEFAULT 0")
        )
        # Backfill: set active=TRUE for any user rows created before server_default was applied
        db.session.execute(
            text("UPDATE users SET active = TRUE WHERE active IS NULL")
        )
        db.session.execute(
            text("UPDATE users SET xp = 0 WHERE xp IS NULL")
        )
        db.session.execute(
            text("UPDATE users SET streak = 0 WHERE streak IS NULL")
        )
        # email_verified — DEFAULT TRUE so existing users are not locked out
        db.session.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE")
        )
        db.session.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS ra VARCHAR(30)")
        )
        db.session.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6)")
        )
        db.session.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP")
        )
        db.session.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS ano_ingresso INTEGER")
        )
        db.session.execute(
            text("""
                CREATE UNIQUE INDEX IF NOT EXISTS uq_users_ra
                ON users (ra) WHERE ra IS NOT NULL
            """)
        )
        db.session.execute(
            text("""
                CREATE TABLE IF NOT EXISTS lists (
                    id SERIAL PRIMARY KEY,
                    professor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    title VARCHAR(255) NOT NULL,
                    deadline TIMESTAMP NOT NULL,
                    published BOOLEAN NOT NULL DEFAULT FALSE,
                    published_at TIMESTAMP NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """)
        )
        db.session.execute(
            text("""
                CREATE TABLE IF NOT EXISTS list_questions (
                    id SERIAL PRIMARY KEY,
                    list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
                    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
                    order_index INTEGER NOT NULL,
                    UNIQUE (list_id, question_id),
                    UNIQUE (list_id, order_index)
                )
            """)
        )
        db.session.execute(
            text("""
                CREATE TABLE IF NOT EXISTS list_submissions (
                    id SERIAL PRIMARY KEY,
                    list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
                    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    started_at TIMESTAMP NULL,
                    submitted_at TIMESTAMP NULL,
                    correct_count INTEGER NOT NULL DEFAULT 0,
                    total_questions INTEGER NOT NULL DEFAULT 0,
                    score_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
                    is_late BOOLEAN NOT NULL DEFAULT FALSE,
                    UNIQUE (list_id, student_id)
                )
            """)
        )
        db.session.execute(
            text("""
                CREATE TABLE IF NOT EXISTS list_submission_answers (
                    id SERIAL PRIMARY KEY,
                    submission_id INTEGER NOT NULL REFERENCES list_submissions(id) ON DELETE CASCADE,
                    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
                    selected_answer VARCHAR(1) NULL,
                    is_correct BOOLEAN NOT NULL
                )
            """)
        )
        db.session.execute(
            text("""
                CREATE TABLE IF NOT EXISTS list_change_log (
                    id SERIAL PRIMARY KEY,
                    list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
                    professor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    action VARCHAR(40) NOT NULL,
                    summary TEXT NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """)
        )
        db.session.execute(
            text("""
                CREATE TABLE IF NOT EXISTS answer_history (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
                    answered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    is_correct BOOLEAN NOT NULL,
                    selected_answer VARCHAR(1) NULL,
                    source VARCHAR(20) NOT NULL,
                    source_id INTEGER NOT NULL,
                    list_id INTEGER NULL REFERENCES lists(id) ON DELETE SET NULL,
                    UNIQUE (source, source_id, question_id)
                )
            """)
        )
        db.session.execute(
            text("CREATE INDEX IF NOT EXISTS idx_lists_professor_id ON lists (professor_id)")
        )
        db.session.execute(
            text("CREATE INDEX IF NOT EXISTS idx_list_submissions_student_id ON list_submissions (student_id)")
        )
        db.session.execute(
            text("CREATE INDEX IF NOT EXISTS idx_list_questions_list_order ON list_questions (list_id, order_index)")
        )
        db.session.execute(
            text("CREATE INDEX IF NOT EXISTS idx_list_submission_answers_submission_id ON list_submission_answers (submission_id)")
        )
        db.session.execute(
            text("CREATE INDEX IF NOT EXISTS idx_answer_history_student_answered_at ON answer_history (student_id, answered_at DESC)")
        )
        db.session.execute(
            text("CREATE INDEX IF NOT EXISTS idx_answer_history_question_answered_at ON answer_history (question_id, answered_at DESC)")
        )
        db.session.execute(
            text("CREATE INDEX IF NOT EXISTS idx_answer_history_list_answered_at ON answer_history (list_id, answered_at DESC)")
        )
        db.session.execute(
            text("CREATE INDEX IF NOT EXISTS idx_answer_history_source_source_id ON answer_history (source, source_id)")
        )
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS turmas (
                id SERIAL PRIMARY KEY,
                professor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS turma_alunos (
                turma_id INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
                student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                PRIMARY KEY (turma_id, student_id)
            )
        """))
        db.session.execute(text("""
            ALTER TABLE lists ADD COLUMN IF NOT EXISTS turma_id INTEGER REFERENCES turmas(id) ON DELETE SET NULL
        """))
        db.session.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_turmas_professor_id ON turmas (professor_id)"
        ))
        db.session.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_turma_alunos_student_id ON turma_alunos (student_id)"
        ))
        db.session.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_lists_turma_id ON lists (turma_id)"
        ))
        db.session.execute(text(
            "ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_type VARCHAR(30) NOT NULL DEFAULT 'multiple_choice'"
        ))
        db.session.execute(text(
            "ALTER TABLE questions ALTER COLUMN correct_answer DROP NOT NULL"
        ))
        db.session.execute(text(
            "ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_q_position VARCHAR(10) NOT NULL DEFAULT 'depois'"
        ))
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS question_proposals (
                id SERIAL PRIMARY KEY,
                question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
                proposer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                changes JSONB NOT NULL,
                reason TEXT,
                admin_note TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                reviewed_at TIMESTAMP
            )
        """))
        db.session.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_question_proposals_question_id ON question_proposals (question_id)"
        ))
        db.session.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_question_proposals_status ON question_proposals (status)"
        ))
        db.session.commit()
    except Exception:
        db.session.rollback()
        app.logger.exception("Falha ao garantir schema incremental do banco.")
        raise
