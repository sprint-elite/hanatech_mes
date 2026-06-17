sudo dnf update -y
sudo dnf install -y nodejs20 npm git nginx
node -v
sudo dnf module list nodejs
sudo dnf install -y nodejs20
node -v
sudo mkdir -p /var/www/mesnew
sudo chown -R ec2-user:ec2-user /var/www/mesnew
cd /var/www/mesnew
sudo dnf install -y mariadb105-server mariadb105
sudo systemctl enable mariadb
sudo systemctl start mariadb
sudo systemctl status mariadb
sudo mysql
nano /var/www/mesnew/.env
sudo dnf install -y unzip
unzip -o mesnew.zip
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
swapon --show
free -h
ls
sudo nano .env
npm run prisma:generate
sudo alternatives --install /usr/bin/node node /usr/bin/node-20 2 2>/dev/null
sudo alternatives --install /usr/bin/npm npm /usr/bin/npm-20 2 2>/dev/null
node -v
sudo alternatives --set node /usr/bin/node-20
sudo alternatives --set npm /usr/bin/npm-20
ls -l /usr/bin/npm*
sudo ln -sf /usr/bin/npm-20 /usr/bin/n
sudo alternatives --install /usr/bin/npm npm /usr/bin/npm-20 20
sudo alternatives --set npm /usr/bin/npm-20
node -v
npm -v
rm -rf node_modules
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:push
pm2 -v
sudo npm install -g pm2
pm2 -v
export PATH=$PATH:/usr/lib/nodejs20/bin
pm2 -v
sudo ln -sf /usr/lib/nodejs20/lib/node_modules/pm2/bin/pm2 /usr/bin/pm2
hash -r
pm2 -v
pm2 start dist/server/index.js --name mes-api
pm2 status
curl http://127.0.0.1:4000/api/health
sudo nano /etc/nginx/conf.d/mesnew.conf
ls -la /var/www/mesnew/dist/
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
sudo nano /etc/nginx/conf.d/mesnew.conf
sudo nginx -t
sudo systemctl restart nginx
curl http://127.0.0.1/api/health
curl http://127.0.0.1:4000/api/health
free -h
sudo nano src/server/index.ts
sudo nano tsup.config.ts
npm install dotenv --save
npm install
npm run build
node --env-file=.env dist/server/index.js
pm2 delete mes-api
pm2 start npm --name mes-api -- start
pm2 save
ls
free -h
ls
node -v
scp -i "C:\Users\cooks\Downloads\hana.pem" "C:\Users\cooks\mesnew\mesnew.zip" ec2-user@3.35.9.204:/home/ec2-user/
ls
unzip -o mesnew.zip
ls
pwd
sudo dnf update -y
sudo dnf install -y unzip tar gcc-c++ make
node -v
npm -v
sudo dnf install -y mariadb105-server
sudo systemctl enable --now mariadb
sudo mysql -u root
sudo nano .env
npm install
free -h
ls
df -h
npm cache clean --force
sudo dnf clean all
sudo rm -rf /var/cache/dnf
sudo rm -rf /tmp/*
df -h
sudo du -xh --max-depth=2 /home/ec2-user | sort -h | tail -n 20
lsblk
sudo growpart /dev/nvme0n1 1
sudo xfs_growfs -d /
df -h
npm install
npm run prisma:generate
sudo chown -R ec2-user:ec2-user /home/ec2-user/mesnew
ls
rm -rf node_modules package-lock.json
npm cache clean --force
cd mesnew
sudo chown -R ec2-user:ec2-user /home/ec2-user
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
ls -l node_modules/.bin/prisma
chmod +x node_modules/.bin/prisma
npm run prisma:generate
npm run prisma:push
npm run build
sudo npm install -g pm2
pm2 start npm --name mesnew-api -- start
npx pm2 start npm --name mesnew-api -- start
sudo npm uninstall -g pm2
sudo npm install -g pm2
hash -r
pm2 -v
node -v
npm -v
which node
which npm
npm prefix -g
npm bin -h
npm bin -g
rpm -q npm nodejs
npm -v
npm prefix -g
ls -l "$(npm prefix -g)/bin" | head
ls -l "$(npm prefix -g)/bin/pm2"
export PATH="$(npm prefix -g)/bin:$PATH"
pm2 -v
sudo rm -f /usr/lib/nodejs20/bin/pm2 /usr/lib/nodejs20/bin/pm2-runtime /usr/lib/nodejs20/bin/pm2-docker
sudo npm uninstall -g pm2
sudo npm install -g pm2
ls -l /usr/lib/nodejs20/lib/node_modules/pm2/bin/pm2
ls -l /usr/lib/nodejs20/bin/pm2
/usr/lib/nodejs20/bin/pm2 -v
sudo rm -f /usr/lib/nodejs20/bin/pm2 /usr/lib/nodejs20/bin/pm2-runtime /usr/lib/nodejs20/bin/pm2-docker
sudo ln -s /usr/lib/nodejs20/lib/node_modules/pm2/bin/pm2 /usr/lib/nodejs20/bin/pm2
sudo ln -s /usr/lib/nodejs20/lib/node_modules/pm2/bin/pm2-runtime /usr/lib/nodejs20/bin/pm2-runtime
sudo ln -s /usr/lib/nodejs20/lib/node_modules/pm2/bin/pm2-docker /usr/lib/nodejs20/bin/pm2-docker
/usr/lib/nodejs20/bin/pm2 -v
echo 'export PATH="/usr/lib/nodejs20/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
pm2 -v
pm2 start npm --name mesnew-api -- start
pm2 save
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/nodejs20/lib/node_modules/pm2/bin/pm2 startup systemd -u ec2-user --hp /home/ec2-user
pm2 save
pm2 status
pm2 delete mes-api
pm2 logs mesnew-api --lines 80
sudo nano tsup.config.js
sudo nano tsup.config.ts
sudo nano package.json
npm run build
sudo nano tsup.config.ts
npm run build
sudo nano .env
npm run build
pm2 restart mesnew-api
pm2 save
. "\home\ec2-user\.cursor-server\bin\linux-x64\81fcf2931d7687b4ff3f3017858d0c6dee7e2a60/out/vs/workbench/contrib/terminal/common/scripts/shellIntegration-bash.sh"
. "\home\ec2-user\.cursor-server\bin\linux-x64\81fcf2931d7687b4ff3f3017858d0c6dee7e2a60/out/vs/workbench/contrib/terminal/common/scripts/shellIntegration-bash.sh"
ls
tar -xzf mesnew-deploy.tar.gz
pwd
ls mesnew 2>/dev/null || echo "mesnew 폴더 없음 — 홈이 프로젝트 루트"
cd mesnew
cd ~
pm2 stop mesnew-api 2>/dev/null
cp .env .env.backup 2>/dev/null
rm -rf ~/mesnew
tar -xzf mesnew-deploy.tar.gz --strip-components=1 -C ~
cp .env.backup .env 2>/dev/null
npm run prisma:generate
npx prisma db push
npm run prisma:push
npm run build
pm2 start mesnew-api
pm2 save
pwd
ls -la src/client/pages/ | head -20
ls src/client/pages/WorkerInputPage.tsx
stat dist/index.html
pm2 show mesnew-api | grep -E "cwd|script|status"
ls -la src/client/ui/App.tsx src/client/ui/Layout.tsx
sudo grep -r "root\|proxy_pass" /etc/nginx/
cd ~
npm run build
sudo mkdir -p /var/www/mesnew
sudo rsync -av --delete ~/dist/ /var/www/mesnew/dist/
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl restart nginx
sudo systemctl status nginx
ls /etc/nginx/conf.d/
sudo grep -r "server_name\|root" /etc/nginx/conf.d/
mysqldump -u root -p --databases mesnew --single-transaction --routines --triggers --set-gtid-purged=OFF > C:\Users\cooks\mesnew_local_dump.sql
free -h
mysqldump -u root -p mesnew > ~/mesnew_server_backup.sql
mysqldump -u mesuser -p mesnew > ~/mesnew_server_backup.sql
mysql -u mesuser -p -e "DROP DATABASE IF EXISTS mesnew; CREATE DATABASE mesnew CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u mesuser -p mesnew < ~/mesnew_local_dump.sql
scp -i C:\Users\cooks\Downloads\hana.pem C:\Users\cooks\mesnew_local_dump.sql ec2-user@3.35.9.204:/home/ec2-user/
mysql -u mesuser -p -e "DROP DATABASE IF EXISTS mesnew; CREATE DATABASE mesnew CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u mesuser -p mesnew < ~/mesnew_local_dump.sql
pm2 restart mesnew-api
head -c 50 ~/mesnew_local_dump.sql
sudo mysql -e "DROP DATABASE IF EXISTS mesnew; CREATE DATABASE mesnew CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql mesnew < ~/mesnew_local_dump.sql
pm2 restart mesnew-api
npm run build
pm2 list
pm2 restart mesnew-api
pm2 save
pm2 restart mesnew-api
pm2 save
pm2 restart mesnew-api
pm2 save
pm2 restart mesnew-api
pm2 save
pm2 restart mesnew-api
pm2 save
