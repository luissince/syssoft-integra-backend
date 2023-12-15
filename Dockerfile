# Fase de construcción
FROM alpine AS builder

# Establecer el directorio de trabajo en /app
WORKDIR /app

# Copiar el archivo package*.json al directorio de trabajo
COPY package*.json ./

# Instalar las dependencias utilizando npm
RUN npm install

# Copiar todos los archivos del contexto actual al directorio de trabajo
COPY . .

# Fase de producción
FROM alpine AS production

# Establecer el directorio de trabajo en /app
WORKDIR /app

# Copiar archivos desde la fase de construcción (--from=builder) al directorio de trabajo
COPY --chown=node:node --from=builder /app .

# Establecer el usuario que ejecutará la aplicación
USER node

# Exponer el puerto 80 para que pueda ser accedido desde fuera del contenedor
EXPOSE 80

# Establecer el punto de entrada para ejecutar la aplicación cuando se inicie el contenedor
ENTRYPOINT ["npm", "start"]
