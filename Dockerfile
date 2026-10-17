FROM nginx:alpine
COPY index.html style.css script.js petcare-icon.jpg /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
