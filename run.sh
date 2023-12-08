docker stop sysintegra-backend && docker rm sysintegra-backend

docker image rm sysintegra-backend

docker build -t sysintegra-backend .

docker run -d \
--restart always \
--name sysintegra-backend \
--net=luis \
-p 6100:80 \
sysintegra-backend