# DES UEM deployment

Published commit: ec50c7017464502ba462972351101b9d2f60bd47.

Legacy entry (redirects to full page): https://des-uem.tailbef376.ts.net/alt-home/aplicativos/staticlass
Application base path: /alt-home/aplicativos/staticlass/app/

The production web build is served by host nginx from /var/www/staticlass.
API requests under app/api/ are proxied to 127.0.0.1:5000.
PostgreSQL runs in its own Docker volume without a published port.
Secrets are in deploy/.env (mode 600, excluded from git).

Update backend:
```sh
sudo docker compose -p staticlass-des -f deploy/compose.yml up -d --build
```

Update frontend from the repository root:
```sh
(cd app/web && STATICLASS_BASE_PATH=/alt-home/aplicativos/staticlass/app/ npm run build)
sudo cp -a app/web/dist/. /var/www/staticlass/
```

DES page and application status were updated in /home/administrador/des-uem.
Nginx configuration source: /home/administrador/des-uem/deploy/nginx-des-uem.conf.
Backups before this deployment: /home/administrador/deployment-backups/staticlass-20261021/.

The repository does not contain banco_questoes/questoes.db. The initial deployment database was later populated; see the ingestion notes below. SMTP is configured through deploy/.env; credentials must remain outside git.
Do not run the demo seed on the public deployment: it creates known passwords.


The Applications card opens the app directly (without iframe). The app has a
small back button to /alt-home/aplicativos. UEM registration accepts numeric RA
and nivel_curso=graduacao or mestrado; the database stores ra<number> or pg<number>.

Email configuration: fill MAIL_USERNAME and MAIL_PASSWORD (SMTP app password),
and optionally MAIL_SERVER, MAIL_PORT, MAIL_USE_TLS, MAIL_USE_SSL and
MAIL_SENDER_EMAIL in deploy/.env. Then recreate the backend:

    sudo docker compose -p staticlass-des -f deploy/compose.yml up -d --force-recreate backend

Delivery failures are now reported in the registration and resend screens.
SMTP authentication and a real confirmation resend to the configured sender were validated on 2026-10-21.


Question ingestion completed on 2026-10-21: 346 questions from Estatistica-Basica
commit c701bed3b4992b3207ef9b035d6f199020f550a6 plus 81 from statl.migrate_apostila.
10 source records without answer keys were excluded; 7 source review flags remain.
142 numbered option sets were extracted from statements without changing answers.
Final counts: 427 questions, 2099 alternatives, 4 chapters and 17 topics.
38 images were decoded from the source Markdown into uploads/propet and verified
through the public Funnel. Question preview and quiz render Markdown images,
tables and formulas using the tested QuestionText component.

Source snapshots, preparation script, backup before import, import logs and
verification report: /home/administrador/staticlass-ingestion/.
A second run of both importers inserted zero questions or alternatives.


## Classroom import (2026-10-21)

30 enrolled courses and 611 posts were inspected through read-only Google APIs.
The private Classroom library contains 137 lists/assignments and 265 support
materials across 27 courses with content. 440 original files were downloaded;
10 Drive attachments returned not found and retain original links. 318 PDFs
were validated, and a real browser opened a worksheet PDF inside Staticlass.

The library is shown in the existing Lists section (and My Lists for students).
Records belong to ra132955@uem.br and are also accessible to the importing admin.
Files are stored in classroom-private/, mounted read-only at /private-classroom,
and are served only after list authorization. They must never be placed in
uploads/, whose pre-existing question image endpoint is public.

Source archive, result report and database backup before import are in
/home/administrador/classroom-import-data/.

To reimport the saved manifest without duplicates:

    docker compose -p staticlass-des -f deploy/compose.yml exec -T backend python -m statl.import_classroom --manifest /tmp/classroom-manifest.json --owner-email ra132955@uem.br --manager-email admin@staticlass.com

If the container was recreated, first copy the saved archive/manifest.json to
/tmp/classroom-manifest.json in the backend container. Google OAuth credentials
remain on the local workstation and are not deployed with these materials.
