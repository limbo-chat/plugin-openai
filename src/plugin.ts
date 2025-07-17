import * as limbo from "@limbo/api";
import {
	convertMessagesToOpenAICompatible,
	convertToolIdToOpenAICompatible,
	convertToolDefinitionsToOpenAICompatible,
	FetchAdapter,
	OpenAICompatibleClient,
	streamOpenAICompatibleChatCompletion,
} from "@limbo/openai-utils";

const OPENAI_API_BASE_URL = "https://api.openai.com/v1";

interface LLMModelConfig {
	id: string;
	name: string;
	description: string;
	capabilities: limbo.LLM.Capability[];
}

const models: LLMModelConfig[] = [
	{
		id: "o4-mini",
		name: "o4-mini",
		description: "Faster, more affordable reasoning model",
		capabilities: ["tool_calling", "structured_outputs"],
	},
	{
		id: "o3",
		name: "o3",
		description: "Our most powerful reasoning model",
		capabilities: ["tool_calling", "structured_outputs"],
	},
	{
		id: "o3-mini",
		name: "o3-mini",
		description: "A small model alternative to o3",
		capabilities: [],
	},
] as const;

export default {
	onActivate: async () => {
		console.log("OpenAI plugin activated");

		// settings

		limbo.settings.register({
			id: "api_key",
			type: "text",
			label: "API Key",
			description: "Your OpenAI API key",
			placeholder: "sk-...",
			variant: "password",
		});

		// models

		for (const model of models) {
			limbo.models.registerLLM({
				id: model.id,
				name: model.name,
				description: model.description,
				capabilities: model.capabilities,
				chat: async ({ tools, prompt, onText, onToolCall, abortSignal }) => {
					const apiKey = limbo.settings.get("api_key");

					if (typeof apiKey !== "string") {
						throw new Error("You must provide an API key to use OpenAI models");
					}

					const client = new OpenAICompatibleClient({
						adapter: new FetchAdapter(),
						baseUrl: OPENAI_API_BASE_URL,
						apiKey,
					});

					const openAITools = convertToolDefinitionsToOpenAICompatible(tools);
					const openAIMessages = convertMessagesToOpenAICompatible(prompt.getMessages());

					const originalToolIdMap = new Map<string, string>();

					for (const tool of tools) {
						const openAICompatibleId = convertToolIdToOpenAICompatible(tool.id);

						originalToolIdMap.set(openAICompatibleId, tool.id);
					}

					const stream = streamOpenAICompatibleChatCompletion(client, {
						model: model.id,
						tools: openAITools,
						messages: openAIMessages,
						abortSignal,
					});

					const collectedToolCalls: any[] = [];

					for await (const chunk of stream) {
						const text = chunk.content;
						const partialToolCalls = chunk.tool_calls;

						if (text) {
							onText(text);
						}

						if (partialToolCalls) {
							for (const partialToolCall of partialToolCalls) {
								const toolInfo = partialToolCall.function;

								if (!toolInfo) {
									continue;
								}

								const partialToolCallIdx = partialToolCall.index;

								if (typeof partialToolCallIdx !== "number") {
									continue;
								}

								const toolCall = collectedToolCalls[partialToolCallIdx];

								if (toolCall) {
									if (toolInfo.name) {
										// note: not sure if the name can be added to during the stream
										toolCall.id += toolInfo.name;
									}

									if (typeof toolInfo.arguments === "string") {
										toolCall.arguments += toolInfo.arguments;
									}
								} else {
									collectedToolCalls.push({
										id: toolInfo.name,
										arguments: toolInfo.arguments || "",
									});
								}
							}
						}
					}

					for (const collectedToolCall of collectedToolCalls) {
						const originalToolId = originalToolIdMap.get(collectedToolCall.id);

						if (!originalToolId) {
							// this will probably never happen
							throw new Error(`Unknown tool call ID: ${collectedToolCall.id}`);
						}

						let parsedArguments;

						try {
							parsedArguments = JSON.parse(collectedToolCall.arguments);
						} catch {
							parsedArguments = {};
						}

						onToolCall({
							toolId: originalToolId,
							arguments: parsedArguments,
						});
					}
				},
			});
		}
	},
} satisfies limbo.Plugin;
