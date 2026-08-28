# Stage 1: Build the React application
FROM node:20 AS build
WORKDIR /app

# Install dependencies separately to leverage Docker cache
COPY package.json package-lock.json* yarn.lock* ./
RUN npm install --legacy-peer-deps

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine
# Copy custom Nginx configuration to handle React Router and API proxying
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts to Nginx html directory
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
