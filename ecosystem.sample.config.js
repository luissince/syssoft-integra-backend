module.exports = {
    apps: [
        {
            name: "inmobilaria",
            script: "./server/index.js",
            watch: true,
            env: {
                "PORT": 5000,
                "NODE_ENV": "development"
            },
            env_production: {
                "ID": 1,
                "PORT": 8000,
                "HOST": "127.0.0.1",
                "DB_USER": "root",
                "DB_PASSWORD": "",
                "DB_NAME": "",
                "DB_HOST": 3306,
                "TZ": "America/Lima",
                "NODE_ENV": "production",
            }
        }
    ]
}