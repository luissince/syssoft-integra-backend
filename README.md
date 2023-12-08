# SOFTWARE DE RESTAURANTE

<!-- ![IMAGES DE GO LANG](images/ladder.svg) -->
<!-- <img src="app/src/recursos/images/syssoftintegra.png" alt="Imagen SysSoft Integra" width="200" /> -->

<font size="5" face="Qwitcher Grypen">
Aplicación para el control de restaurantes.
</font>

## Iniciar

Esta proyecto esta echo en react js con tailwind css.

Algunos recursos para iniciar con este proyecto puedes ver en:

- [Node Js](https://nodejs.org/es/) Entorno de desarrollo para aplicación web o movil usando JavaScript.
- [React Js](https://reactjs.org/) Biblioteca para diseñar interfeces de usuario usando JavaScript.
- [Visual Studio](https://code.visualstudio.com/) Editor de código para todos tipos de lenguaje de programación.
- [Tailwindcss](https://tailwindcss.com/) Framework css para la parte visual.
- [TypeScript](https://www.typescriptlang.org/) Lenguaje de programación de tipado fuerte.
- [JavaScript](https://developer.mozilla.org/es/docs/Web/JavaScript) Lenguaje de programación interpretado.
- [Git](https://git-scm.com/) Software de control de versiones.
- [Git Hub](https://github.com/) Plataforma de alojamiento de proyecto de todo ámbito.

## Instalación

Siga los pasos para iniciar el desarrollo:

1.  Clona el proyecto o agrague el ssh al repositorio para contribuir en nuevos cambios [Git Hub - Software Restaurante](https://github.com/luissince/SoftwareRestaurante)

    1.1. Agregue por ssh para la integración

    #Code

        /**
        ** Para el proceso de integración **
        **/

        // ejecute en su consola cmd, bash, git los siguientes comandos

        // Generar tu clave ssh para poder contribuir al proyecto
        ssh-keygen -t rsa -b 4096 -C "tu email"

        // Configuración global del nombre
        git config --global user.name "John Doe"

        // Configuración global del email
        git config --global user.email johndoe@example.com

        // crea una carpeta
        mkdir SoftwareRestaurante

        // moverse a la carpeta
        cd SoftwareRestaurante

        // comando que inicia git
        git init

        // comando que agrega la referencia de la rama
        git remote add origin git@github.com:luissince/SoftwareRestaurante.git

        // comando que descarga los archivos al working directory
        git fetch origin master

        // comando que une los cambios al staging area
        git merge origin/master

    2.2 Clonar

        #code

        /**
        ** Para el proceso de clonación **
        **/

        // Clonar al proyecto
        git clone https://github.com/luissince/SoftwareRestaurante.git

2.  Instale typescript si su proyecto lo usa

    #Code

        npm install -g typescript

3.  Ejecute en la carpeta la clonada **npm install** para descargar las dependencias del proyecto

    #Code

        npm install

4.  Copiar el arhivo de la ruta del EndPoint en app/.env.env.development.example

    #code

        <!-- copie el archivo .env.development.example a .env.development  -->
        cp .env.development.example .env.development

5.  Configuración de la variables de entorno del front-end

        #code

            <!-- ruta para las peticiones del back-end princial -->
            REACT_APP_END_POINT=http://localhost:3002

            <!-- ruta para en envió de las facturas electrónicas -->
            REACT_APP_URL=http://localhost:3002

            <!-- ruta para las peticiones http -->
            REACT_APP_IMAGE=http://localhost:3002

6.  Copiar el arhivo de la configuración del servidor en server/.env

    #code

        <!-- copie el archivo .env.development.example a .env.development  -->
        cp .env.example .env

7.  Configuración de la variables de entorno del back-end

    #code

         <!-- puerto del servidor -->
        PORT=5000

        <!-- ip o nombre del servidor de la base datos -->
        DB_HOST=
        //nombre de usuario del servidor de la base de datos
        DB_USER=

        <!-- contraseña del usuario del servidor de la base de datos -->
        DB_PASSWORD=

        <!-- nombre del servidor de la base de la base de datos -->
        DB_NAME=

        <!-- puerto del servidor de base de datos -->
        DB_PORT=3306

        <!-- Configuración de la zona horaria del servidor -->
        TZ="America/Lima"

8. Agregar la propiedad **"proxy": "http://localhost:3002"** el package.json de la carpeta app/package.json con la url del back-end, ese propiedad es solo para desarrollo

    #code 

         "proxy": "http://localhost:5000"

9.  Ejecute **npm run dev:app** para iniciar el front-end

    #code

        npm run dev:app

10. Ejecute **npm run dev:server** para iniciar el backend-end

    #code

        npm run dev:server

11. Ejecute **npm run build** para construir le proyecto

    #code

        npm run build
