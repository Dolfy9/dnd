from . import admin, auth, battles, catalogs, entities, graph_api, map_api, media, pages, rules_api, schemas_api, search

routers = [
    auth.router, pages.router, entities.router, search.router, graph_api.router,
    catalogs.router, map_api.router, battles.router, rules_api.router, media.router,
    schemas_api.router, admin.router,
]
