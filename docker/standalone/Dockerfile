# The standalone image of technitium-console (README, "Docker"). A web container:
# it serves the console and forwards the API to the Technitium server named by
# TECHNITIUM_URL, and nothing is installed on that server.
#
# No RUN: nothing executes at build time, so the three platforms build anywhere
# without emulation. ADD unpacks the release's own tarball, and the console's
# folder holds nothing else, which is what lets the publishing workflow compare
# it file by file against that tarball on every platform (contract D4).
#
# It keeps the base image's non-root user, its port 8080 and its stop signal.
FROM nginxinc/nginx-unprivileged:1.30.6-alpine
ADD --chown=0:0 technitium-console.tar.gz /usr/share/technitium-console/www/
COPY nginx.conf /etc/nginx/nginx.conf
COPY entrypoint.sh /usr/share/technitium-console/entrypoint.sh
ENTRYPOINT ["/bin/sh", "/usr/share/technitium-console/entrypoint.sh"]
