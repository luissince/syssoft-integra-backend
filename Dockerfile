# Establece la imagen base para la fase de construcción (builder) utilizando Node.js en Alpine
FROM node:lts-alpine AS builder

# Establece el directorio de trabajo para la fase de construcción
WORKDIR /app

# Copia los archivos de descripción del paquete (package.json y package-lock.json si existen)
COPY package*.json ./

# Instala las dependencias para la fase de construcción
RUN npm install

# Copia todo el código fuente al directorio de trabajo para la fase de construcción
COPY . .

# Inicia la fase de producción utilizando una nueva imagen Node.js en Alpine
FROM node:lts-alpine AS production

# Establece el directorio de trabajo para la fase de producción
WORKDIR /app

# Copia los archivos desde la fase de construcción a la fase de producción, asignando los permisos al usuario 'node'
COPY --chown=node:node --from=builder /app .

# Cambia al usuario 'node' para mejorar la seguridad
USER node

# Expone el puerto 80 para permitir conexiones desde fuera del contenedor
EXPOSE 80

# Establece el punto de entrada para la aplicación, indicando cómo iniciarla
ENTRYPOINT ["npm", "start"]
