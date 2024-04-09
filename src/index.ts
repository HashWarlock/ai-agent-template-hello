import { Request, Response, route } from './httpSupport'
import { renderHtml } from './uiSupport'

import OpenAI from 'openai'

async function getLocation() {
    const response = await fetch("https://ipapi.co/json/");
    const locationData = await response.json();
    return locationData;
}

async function getCurrentWeather(latitude: any, longitude: any) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=apparent_temperature`;
    const response = await fetch(url);
    const weatherData = await response.json();
    return weatherData;
}

const tools = [
    {
        type: "function",
        function: {
            name: "getCurrentWeather",
            description: "Get the current weather in a given location",
            parameters: {
                type: "object",
                properties: {
                    latitude: {
                        type: "string",
                    },
                    longitude: {
                        type: "string",
                    },
                },
                required: ["longitude", "latitude"],
            },
        }
    },
    {
        type: "function",
        function: {
            name: "getLocation",
            description: "Get the user's location based on their IP address",
            parameters: {
                type: "object",
                properties: {},
            },
        }
    },
];

const availableTools = {
    getCurrentWeather,
    getLocation,
};

const messages = [
    {
        role: "system",
        content: `You are a helpful assistant. Only use the functions you have been provided with.`,
    },
];

async function agent(openai: any, userInput: any) {
    messages.push({
        role: "user",
        content: userInput,
    });

    for (let i = 0; i < 5; i++) {
        console.log(`[${i}]chat`)
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: messages,
            tools: tools,
        });

        const { finish_reason, message } = response.choices[0];

        if (finish_reason === "tool_calls" && message.tool_calls) {
            const functionName = message.tool_calls[0].function.name;
            const functionToCall = availableTools[functionName];
            const functionArgs = JSON.parse(message.tool_calls[0].function.arguments);
            const functionArgsArr = Object.values(functionArgs);
            const functionResponse = await functionToCall.apply(
                null,
                functionArgsArr
            );

            messages.push({
                role: "function",
                name: functionName,
                content: `
                The result of the last function was this: ${JSON.stringify(
                    functionResponse
                )}
                `,
            });
        } else if (finish_reason === "stop") {
            messages.push(message);
            return message.content;
        }
    }
    return "The maximum number of iterations has been met without a suitable answer. Please try again with a more specific input.";
}

async function GET(req: Request): Promise<Response> {
    const secret = req.queries?.key ?? '';
    const openaiApiKey = req.secret?.openaiApiKey as string;
    const openai = new OpenAI({ apiKey: openaiApiKey })
    const query = req.queries.chatQuery[0] as string;

    const response = await agent(openai, query);

    return new Response(renderHtml(response as string))
}

async function POST(req: Request): Promise<Response> {
    const secret = req.queries?.key ?? '';
    const openaiApiKey = req.secret?.openaiApiKey as string;
    const openai = new OpenAI({ apiKey: openaiApiKey })
    const query = req.queries.chatQuery[0] as string;

    const response = await agent(openai, query);

    return new Response(renderHtml(response as string))
}

export default async function main(request: string) {
    return await route({ GET, POST }, request)
}
