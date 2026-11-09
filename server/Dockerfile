# The WordFall multiplayer server. Build from the repository root (it needs data/):
#   docker build -f server/Dockerfile -t wordfall-server .
#   docker run -p 8080:8080 wordfall-server
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY server/WordFall.Server/WordFall.Server.csproj server/WordFall.Server/
RUN dotnet restore server/WordFall.Server/WordFall.Server.csproj
COPY server/WordFall.Server/ server/WordFall.Server/
RUN dotnet publish server/WordFall.Server/WordFall.Server.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
COPY data/words_*.txt data/
ENV Multiplayer__DataPath=/app/data \
    PORT=8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "WordFall.Server.dll"]
