FROM nginx:alpine
COPY index.html style.css script.js petcare-icon.jpg /usr/share/nginx/html/
EXPOSE 80
