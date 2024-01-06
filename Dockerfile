# Establecer la imagen base para la etapa de construcción (builder)
FROM node:18-alpine AS builder

# Establecer el directorio de trabajo en /app
WORKDIR /app

# Copiar los archivos de configuración de dependencias (package.json y package-lock.json si existe)
COPY package*.json ./

# Instalar las dependencias de la aplicación
RUN npm install

# Copiar todos los archivos al directorio de trabajo
COPY . .

# Establecer la imagen base para la etapa de producción
FROM node:18-alpine AS production

# Establecer el directorio de trabajo en /app
WORKDIR /app

# Copiar los archivos desde la etapa de construcción (builder) al directorio de trabajo
COPY --chown=node:node --from=builder /app .

# Cambiar al usuario no privilegiado (node) por razones de seguridad
USER node

# Exponer el puerto 80 para la aplicación
EXPOSE 80

# Establecer el punto de entrada para iniciar la aplicación
ENTRYPOINT ["npm", "start"]
