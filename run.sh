docker stop sysintegra-backend && docker rm sysintegra-backend

docker image rm sysintegra-backend-image

docker build -t sysintegra-backend-image .

docker run -d \
--restart always \
--name sysintegra-backend \
--net=luis \
-p 6001:80 \
sysintegra-backend-image