import {
  ContentTypeHeader,
  JSONResponseType,
  parseResponse,
  XSolidStartOrigin,
  XSolidStartResponseTypeHeader
} from "./responses";

export type InlineServer<E extends any[], T extends (...args: [...E]) => void> = {
  url: string;
  action(...args: [...E]): ReturnType<T>;
  fetch(init: RequestInit): Promise<Response>;
} & ((...args: [...E]) => ReturnType<T>);

let fetcher = fetch;
export const setFetcher = fetch => {
  fetcher = fetch;
};

function createRequestInit(...args) {
  // parsing args when a request is made from the browser for a server module
  // FormData
  // Request
  // Headers
  //
  let body,
    headers = {
      [XSolidStartOrigin]: "client"
    };

  if (args.length === 1 && args[0] instanceof FormData) {
    body = args[0];
  } else {
    // special case for when server is used as fetcher for createResource
    // we set {}.value to undefined. This keeps the createResource API intact as the type
    // of this object is { value: T | undefined; refetching: boolean }
    // So the user is expected to check value for undefined, and by setting it as undefined
    // we can match user expectations that they dont have access to previous data on
    // the server
    if (Array.isArray(args) && args.length > 2) {
      let secondArg = args[1];
      if (typeof secondArg === "object" && "value" in secondArg && "refetching" in secondArg) {
        secondArg.value = undefined;
      }
    }
    body = JSON.stringify(args, (key, value) => {
      if (value instanceof Headers) {
        return {
          $type: "headers",
          values: [...value.entries()]
        };
      }
      if (value instanceof Request) {
        return {
          $type: "request",
          url: value.url,
          method: value.method,
          headers: value.headers
        };
      }
      return value;
    });
    headers[ContentTypeHeader] = JSONResponseType;
  }

  return {
    method: "POST",
    body: body,
    headers: {
      ...headers
    }
  };
}

export const createFetcher = route => {
  let fetcher: any = function (this: Request, ...args: any[]) {
    if (this instanceof Request) {
    }
    const requestInit = createRequestInit(...args);
    // request body: json, formData, or string
    return call(route, requestInit);
  };

  fetcher.url = route;
  fetcher.fetch = (init: RequestInit) => call(route, init);
  // fetcher.action = async (...args: any[]) => {
  //   const requestInit = createRequestInit(...args);
  //   // request body: json, formData, or string
  //   return server.call(route, requestInit);
  // };
  return fetcher as InlineServer<any, any>;
};

export const call = async function (route, init: RequestInit) {
  const request = new Request(new URL(route, window.location.href).href, init);

  const response = await fetcher(request);

  // throws response, error, form error, json object, string
  if (response.headers.get(XSolidStartResponseTypeHeader) === "throw") {
    throw await parseResponse(request, response);
  } else {
    return await parseResponse(request, response);
  }
};
