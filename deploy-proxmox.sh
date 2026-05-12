#!/bin/bash
# -----------------------------------------------------------------------------
# Improved Initiative - Script de déploiement automatique pour LXC Proxmox
# Ce script installe Node.js, Redis, MongoDB, Git et PM2, clone le dépôt
# et configure l'application pour qu'elle tourne en tâche de fond.
# -----------------------------------------------------------------------------

set -e

echo "==========================================================="
echo "   Improved Initiative - Installation Automatisée (Proxmox)"
echo "==========================================================="

# 1. Vérification des droits root
if [ "$EUID" -ne 0 ]; then
  echo "[ERREUR] Ce script doit être exécuté en tant que root (ou avec sudo)."
  exit 1
fi

echo -e "\n[1/6] Mise à jour du système et installation des prérequis..."
apt-get update -y
apt-get install -y curl gnupg git build-essential

echo -e "\n[2/6] Installation de Node.js v18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

echo -e "\n[3/6] Installation de Redis..."
apt-get install -y redis-server
systemctl enable redis-server
systemctl start redis-server

echo -e "\n[4/6] Installation de MongoDB v7.0..."
if ! command -v mongod &> /dev/null; then
    curl -fsSL https://pgp.mongodb.com/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor --yes
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    apt-get update -y
    apt-get install -y mongodb-org
    systemctl enable mongod
    systemctl start mongod
else
    echo "MongoDB est déjà installé."
fi

echo -e "\n[5/6] Récupération du projet depuis GitHub..."
INSTALL_DIR="/opt/improved-initiative"
REPO_URL="https://github.com/Clodlaser/improved-initiative.git"

if [ -d "$INSTALL_DIR" ]; then
  echo "Le dossier $INSTALL_DIR existe déjà. Mise à jour (git pull)..."
  cd "$INSTALL_DIR"
  git checkout main
  git pull origin main
else
  echo "Clonage du projet dans $INSTALL_DIR..."
  git clone -b main "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

echo "Installation des dépendances npm et compilation..."
npm install
npm run build

echo -e "\n[6/6] Configuration de PM2..."
npm install -g pm2

# Récupérer l'adresse IP locale principale du conteneur
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo "IP Locale détectée : $LOCAL_IP"

# Création du fichier ecosystem.config.js
cat <<EOF > ecosystem.config.js
module.exports = {
  apps : [{
    name: "improved-initiative",
    script: "npm",
    args: "run start",
    env: {
      NODE_ENV: "production",
      PORT: 8090,
      BASE_URL: "http://${LOCAL_IP}:8090",
      WEB_CONCURRENCY: 1,
      TAG_DEBUG: 1,
      DEFAULT_ACCOUNT_LEVEL: "epicinitiative",
      DEFAULT_PATREON_ID: "local-dev",
      DB_CONNECTION_STRING: "mongodb://127.0.0.1:27017/improved-initiative"
    }
  }]
}
EOF

echo "Démarrage du projet avec PM2..."
# Au cas où une ancienne instance existe
pm2 delete improved-initiative 2>/dev/null || true
pm2 start ecosystem.config.js

echo "Configuration du démarrage automatique (pm2 startup)..."
# PM2 startup setup without relying on the generic path since we know it's systemd
pm2 startup systemd -u root --hp /root || true
pm2 save

echo "==========================================================="
echo "   Installation terminée avec succès !"
echo "   L'application devrait être accessible sur :"
echo "   http://${LOCAL_IP}:8090"
echo "==========================================================="
