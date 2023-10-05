FROM ubuntu: latest
RUN apt-get update
RUN apt-get -y install nginx
COPY index.html /var/www/html/index.html
EXPOSE 80
CMD ["nginx", "-9", "daemon off;"]
