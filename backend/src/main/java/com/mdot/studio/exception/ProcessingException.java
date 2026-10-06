package com.mdot.studio.exception;

public class ProcessingException extends RuntimeException {
    private final String userMessage;

    public ProcessingException(String userMessage) {
        super(userMessage);
        this.userMessage = userMessage;
    }

    public ProcessingException(String userMessage, Throwable cause) {
        super(userMessage, cause);
        this.userMessage = userMessage;
    }

    public String getUserMessage() {
        return userMessage;
    }
}
