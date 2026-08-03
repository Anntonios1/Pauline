from api.routes.auth import routes as auth_routes
from api.routes.users import routes as users_routes
from api.routes.courses import routes as courses_routes
from api.routes.categories import routes as categories_routes
from api.routes.publications import routes as publications_routes
from api.routes.activities import routes as activities_routes
from api.routes.questions import routes as questions_routes
from api.routes.attempts import routes as attempts_routes
from api.routes.resources import routes as resources_routes
from api.routes.comments import routes as comments_routes
from api.routes.events import routes as events_routes
from api.routes.audit import routes as audit_routes
from api.routes.stats import routes as stats_routes
from api.routes.rooms import routes as rooms_routes
from api.routes.quizzes import routes as quizzes_routes
from api.routes.class_events import routes as class_events_routes
from api.routes.achievements import routes as achievements_routes
from api.routes.notifications import routes as notifications_routes
from api.routes.research import routes as research_routes

routes_registry = []
routes_registry.extend(auth_routes)
routes_registry.extend(users_routes)
routes_registry.extend(courses_routes)
routes_registry.extend(categories_routes)
routes_registry.extend(publications_routes)
routes_registry.extend(activities_routes)
routes_registry.extend(questions_routes)
routes_registry.extend(attempts_routes)
routes_registry.extend(resources_routes)
routes_registry.extend(comments_routes)
routes_registry.extend(events_routes)
routes_registry.extend(audit_routes)
routes_registry.extend(stats_routes)
routes_registry.extend(rooms_routes)
routes_registry.extend(quizzes_routes)
routes_registry.extend(class_events_routes)
routes_registry.extend(achievements_routes)
routes_registry.extend(notifications_routes)
routes_registry.extend(research_routes)

__all__ = ["routes_registry"]
