FROM ubuntu: latest
RUN apt-get update
RUN apt-get -y install nginx
COPY app.js Weather_App/src/app.js
EXPOSE 80
CMD ["nginx", "-9", "daemon off;"]
