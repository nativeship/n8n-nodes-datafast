"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatafastApiApi = void 0;
class DatafastApiApi {
    constructor() {
        this.name = "datafastApiApi";
        this.displayName = "DataFast API";
        this.documentationUrl = "https://datafa.st/docs/api";
        this.icon = {
            light: "file:../nodes/DatafastApi/datafastApi.svg",
            dark: "file:../nodes/DatafastApi/datafastApi.dark.svg"
        };
        this.properties = [
            {
                displayName: "Access Token",
                name: "secret",
                type: "string",
                typeOptions: {
                    password: true
                },
                default: "",
                required: true
            }
        ];
        this.authenticate = {
            type: "generic",
            properties: {
                headers: {
                    Authorization: "=Bearer {{$credentials.secret}}"
                }
            }
        };
        this.test = {
            request: {
                baseURL: "https://datafa.st/api/v1",
                url: "/admin/account"
            }
        };
    }
}
exports.DatafastApiApi = DatafastApiApi;
//# sourceMappingURL=DatafastApiApi.credentials.js.map