package com.saas.school.modules.idcard.dto;

import java.util.List;

public class BulkIdCardRequest {

    private String cardType;
    private List<String> userIds;

    public BulkIdCardRequest() {
    }

    public String getCardType() {
        return cardType;
    }

    public void setCardType(String cardType) {
        this.cardType = cardType;
    }

    public List<String> getUserIds() {
        return userIds;
    }

    public void setUserIds(List<String> userIds) {
        this.userIds = userIds;
    }
}
