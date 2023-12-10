# Usa la última imagen estable de Node.js como base
FROM node:18

# Crea el directorio de la aplicación
WORKDIR /home/app

# Copia todo el código fuente de la aplicación
COPY . .

# Instala las dependencias antes de copiar todo el código fuente
RUN npm install

# Expone el puerto en el que la aplicación está escuchando
EXPOSE 6001

# Establece el comando predeterminado para iniciar la aplicación
CMD ["npm", "start"]