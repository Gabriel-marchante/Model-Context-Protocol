export class BaseToolHandler {
    createErrorResponse(message) {
        return {
            content: [{
                    type: 'text',
                    text: `Error: ${message}`,
                }],
            isError: true,
        };
    }
    createSuccessResponse(content) {
        return {
            content: Array.isArray(content) ? content : [{
                    type: 'text',
                    text: content,
                }],
            isError: false,
        };
    }
}
