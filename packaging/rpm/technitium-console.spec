Name:           technitium-console
Version:        1.4.0
Release:        1%{?dist}
Summary:        Modern administration console for Technitium DNS Server
License:        GPL-3.0-or-later
URL:            https://github.com/byGarcia/technitium-console
BuildArch:      noarch

%description
Static web console served by Technitium DNS Server 15.5 or later.
This package lays the files down in %{_datadir}/technitium-console;
point the server at them with DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH.
The one-line installer remains the recommended path on a live server.

%install
mkdir -p %{buildroot}%{_datadir}/technitium-console
mkdir -p %{buildroot}%{_docdir}/technitium-console
cp -a %{_sourcedir}/dist/. %{buildroot}%{_datadir}/technitium-console/
find %{buildroot}%{_datadir}/technitium-console -type f -exec chmod 0644 {} +
find %{buildroot}%{_datadir}/technitium-console -type d -exec chmod 0755 {} +
cp %{_sourcedir}/install.sh %{buildroot}%{_docdir}/technitium-console/install.sh
cp %{_sourcedir}/LICENSE %{buildroot}%{_docdir}/technitium-console/

%files
%{_datadir}/technitium-console/
%{_docdir}/technitium-console/

%post
cat <<'EOF'

  technitium-console is installed in %{_datadir}/technitium-console.

  To serve it from Technitium DNS Server 15.5 or later, set on the server:
    DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH=%{_datadir}/technitium-console
  and restart the DNS service once.

  The one-line installer remains the recommended path on a live server
  (it verifies the running service and can roll back):
    curl -sSL https://raw.githubusercontent.com/byGarcia/technitium-console/main/install.sh | sudo sh

EOF

%changelog
* Sat Nov 07 2026 9M2PJU <9m2pju@gmail.com> - 1.4.0-1
- Initial distro packaging: prebuilt bundle, docs and activation notes.
