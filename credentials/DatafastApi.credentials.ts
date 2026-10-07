import { type IAuthenticateGeneric, type Icon, type ICredentialTestRequest, type ICredentialType, type INodeProperties } from "n8n-workflow";

// Generated with ts-morph
export class DatafastApi implements ICredentialType {
  name = "datafastApi";
  displayName = "DataFast API";
  documentationUrl = "https://datafa.st/docs/api";
  icon: Icon = {
        light: "file:../nodes/Datafast/datafast.svg",
        dark: "file:../nodes/Datafast/datafast.dark.svg"
    };
  properties: INodeProperties[] = [
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
  authenticate: IAuthenticateGeneric = {
        type: "generic",
        properties: {
            headers: {
                Authorization: "=Bearer {{$credentials.secret}}"
            }
        }
    };
  test: ICredentialTestRequest = {
        request: {
            baseURL: "https://datafa.st/api/v1",
            url: "/admin/account"
        }
    };
}
