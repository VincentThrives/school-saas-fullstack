package com.saas.school.common.response;

import java.util.List;

public class PageResponse<T> {

    private List<T> content;
    private long totalElements;
    private int totalPages;
    private int page;
    private int size;

    public PageResponse() {
    }

    public PageResponse(List<T> content, long totalElements, int totalPages, int page, int size) {
        this.content = content;
        this.totalElements = totalElements;
        this.totalPages = totalPages;
        this.page = page;
        this.size = size;
    }

    public List<T> getContent() {
        return content;
    }

    public void setContent(List<T> content) {
        this.content = content;
    }

    public long getTotalElements() {
        return totalElements;
    }

    public void setTotalElements(long totalElements) {
        this.totalElements = totalElements;
    }

    public int getTotalPages() {
        return totalPages;
    }

    public void setTotalPages(int totalPages) {
        this.totalPages = totalPages;
    }

    public int getPage() {
        return page;
    }

    public void setPage(int page) {
        this.page = page;
    }

    public int getSize() {
        return size;
    }

    public void setSize(int size) {
        this.size = size;
    }

    public static <T> PageResponse<T> of(List<T> content, long totalElements, int page, int size) {
        PageResponse<T> response = new PageResponse<>();
        response.setContent(content);
        response.setTotalElements(totalElements);
        response.setTotalPages((int) Math.ceil((double) totalElements / size));
        response.setPage(page);
        response.setSize(size);
        return response;
    }
}
