# docker stop sysintegra-backend && docker rm sysintegra-backend

# docker image rm sysintegra-backend-image

# docker build -t sysintegra-backend-image .

# docker run -d \
# --restart always \
# --name sysintegra-backend \
# --net=luis \
# -p 6001:80 \
# sysintegra-backend-image

#!/bin/bash

rm -rf ./app
git clone -b development https://github.com/luissince/syssoft-integra-frontend.git ./app
cd app
npm install

# Crear el archivo .env con las variables de entorno
echo "VITE_APP_BACK_END=http://localhost:5002" > .env
echo "VITE_APP_CPE_SUNAT=http://localhost:5002" >> .env
echo "VITE_APP_APIS_PERU=http://localhost:5002" >> .env
echo "VITE_APP_IMAGE=http://localhost:5002/imagen/" >> .env
echo "VITE_APP_PDF=http://localhost:5002" >> .env

# Cargar las variables de entorno en la sesión actual
source .env

# Compilar la aplicación
npm run build