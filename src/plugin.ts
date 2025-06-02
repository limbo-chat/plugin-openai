import * as limbo from "limbo";
import {
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
				streamText: async ({ tools, messages, onText, onToolCall }) => {
					const apiKey = limbo.settings.get("api_key");

					if (typeof apiKey !== "string") {
						throw new Error("You must provide an API key to use OpenAI models");
					}

					const client = new OpenAICompatibleClient({
						adapter: new FetchAdapter(),
						baseUrl: OPENAI_API_BASE_URL,
						apiKey,
					});

					await streamOpenAICompatibleChatCompletion(client, {
						model: model.id,
						tools,
						messages,
						onText,
						onToolCall,
					});
				},
			});
		}
	},
} satisfies limbo.Plugin;
