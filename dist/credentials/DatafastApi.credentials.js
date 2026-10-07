"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatafastApi = void 0;
class DatafastApi {
    constructor() {
        this.name = "datafastApi";
        this.displayName = "DataFast API";
        this.documentationUrl = "https://datafa.st/docs/api";
        this.icon = {
            light: "file:../nodes/Datafast/datafast.svg",
            dark: "file:../nodes/Datafast/datafast.dark.svg"
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
exports.DatafastApi = DatafastApi;
//# sourceMappingURL=DatafastApi.credentials.js.map