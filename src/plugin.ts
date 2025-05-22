import * as limbo from "limbo";
import { OpenAIClient } from "openai-fetch";

/**
 * Considerations:
 * - I will probably end up making an openai-compatible utility for plugins to use, including this one
 */

const models = [
	{
		id: "o4-mini",
		name: "o4-mini",
		description: "Faster, more affordable reasoning model",
	},
] as const;

export default {
	onActivate: async () => {
		console.log("OpenAI plugin activated");

		// --- settings ---

		limbo.settings.register({
			id: "api_key",
			type: "text",
			label: "API Key",
			description: "Your OpenAI API key",
			placeholder: "sk-...",
			variant: "password",
		});

		for (const model of models) {
			limbo.models.registerLLM({
				id: model.id,
				name: model.name,
				description: model.description,
				generateText: async ({ promptBuilder, onChunk }) => {
					const apiKey = limbo.settings.get("api_key");

					if (typeof apiKey !== "string") {
						return limbo.notifications.show({
							type: "warning",
							message: "You must provide an API key to use OpenAI models",
						});
					}

					const client = new OpenAIClient({ apiKey });

					const response = await client.streamChatCompletion({
						model: model.id,
						messages: promptBuilder.getMessages(),
					});

					const reader = response.getReader();

					while (true) {
						const readResult = await reader.read();

						if (readResult.done) {
							break;
						}

						const chunk = readResult.value;

						if (!chunk) {
							return;
						}

						const chunkText = chunk.choices[0]?.delta.content;

						if (chunkText) {
							onChunk(chunkText);
						}
					}
				},
			});
		}
	},
} satisfies limbo.Plugin;
