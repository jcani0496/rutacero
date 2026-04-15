package com.rutacero.app.billing;

import androidx.annotation.NonNull;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "GooglePlayBilling")
public class GooglePlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient billingClient;
    private final Map<String, ProductDetails> productDetailsById = new HashMap<>();
    private String pendingPurchaseCallId;
    private String pendingProductId;

    @Override
    public void load() {
        super.load();
        billingClient = BillingClient
            .newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(
                PendingPurchasesParams
                    .newBuilder()
                    .enableOneTimeProducts()
                    .build()
            )
            .enableAutoServiceReconnection()
            .build();
    }

    @Override
    protected void handleOnDestroy() {
        if (billingClient != null) {
            billingClient.endConnection();
        }
    }

    private interface BillingClientAction {
        void run();
    }

    private void withReadyClient(PluginCall call, BillingClientAction action) {
        if (billingClient == null) {
            call.reject("Google Play Billing is not initialized");
            return;
        }

        if (billingClient.isReady()) {
            action.run();
            return;
        }

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    action.run();
                    return;
                }

                call.reject("Google Play Billing setup failed", String.valueOf(billingResult.getResponseCode()));
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Capacitor will retry by calling the plugin again.
            }
        });
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        withReadyClient(call, () -> {
            JSObject result = new JSObject();
            result.put("available", true);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void getProductDetails(PluginCall call) {
        JSArray productIds = call.getArray("productIds");
        if (productIds == null || productIds.length() == 0) {
            call.reject("Missing productIds");
            return;
        }

        withReadyClient(call, () -> {
            List<QueryProductDetailsParams.Product> products = new ArrayList<>();
            for (int i = 0; i < productIds.length(); i++) {
                String productId = productIds.optString(i, null);
                if (productId == null || productId.isEmpty()) {
                    continue;
                }

                products.add(
                    QueryProductDetailsParams.Product
                        .newBuilder()
                        .setProductId(productId)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
                );
            }

            QueryProductDetailsParams params = QueryProductDetailsParams
                .newBuilder()
                .setProductList(products)
                .build();

            billingClient.queryProductDetailsAsync(params, (billingResult, queryResult) -> {
                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject("Google Play product query failed", String.valueOf(billingResult.getResponseCode()));
                    return;
                }

                JSArray serializedProducts = new JSArray();
                for (ProductDetails productDetails : queryResult.getProductDetailsList()) {
                    productDetailsById.put(productDetails.getProductId(), productDetails);
                    serializedProducts.put(serializeProductDetails(productDetails));
                }

                JSObject result = new JSObject();
                result.put("products", serializedProducts);
                call.resolve(result);
            });
        });
    }

    @PluginMethod
    public void purchaseProduct(PluginCall call) {
        String productId = call.getString("productId");
        if (productId == null || productId.isEmpty()) {
            call.reject("Missing productId");
            return;
        }

        withReadyClient(call, () -> {
            ProductDetails productDetails = productDetailsById.get(productId);
            if (productDetails == null) {
                queryProductAndLaunch(call, productId);
                return;
            }

            launchBillingFlow(call, productDetails);
        });
    }

    private void queryProductAndLaunch(PluginCall call, String productId) {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        products.add(
            QueryProductDetailsParams.Product
                .newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        );

        QueryProductDetailsParams params = QueryProductDetailsParams
            .newBuilder()
            .setProductList(products)
            .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, queryResult) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                call.reject("Google Play product query failed", String.valueOf(billingResult.getResponseCode()));
                return;
            }

            List<ProductDetails> resultProducts = queryResult.getProductDetailsList();
            if (resultProducts.isEmpty()) {
                call.reject("Google Play product is unavailable");
                return;
            }

            ProductDetails productDetails = resultProducts.get(0);
            productDetailsById.put(productDetails.getProductId(), productDetails);
            launchBillingFlow(call, productDetails);
        });
    }

    private void launchBillingFlow(PluginCall call, ProductDetails productDetails) {
        BillingFlowParams.ProductDetailsParams.Builder detailsParamsBuilder = BillingFlowParams.ProductDetailsParams
            .newBuilder()
            .setProductDetails(productDetails);
        ProductDetails.OneTimePurchaseOfferDetails offerDetails = getPrimaryOffer(productDetails);
        if (offerDetails != null && offerDetails.getOfferToken() != null) {
            detailsParamsBuilder.setOfferToken(offerDetails.getOfferToken());
        }

        BillingFlowParams.Builder flowBuilder = BillingFlowParams
            .newBuilder()
            .setProductDetailsParamsList(
                java.util.Collections.singletonList(detailsParamsBuilder.build())
            );
        String obfuscatedAccountId = call.getString("obfuscatedAccountId");
        if (obfuscatedAccountId != null && !obfuscatedAccountId.isEmpty()) {
            flowBuilder.setObfuscatedAccountId(obfuscatedAccountId);
        }

        saveCall(call);
        pendingPurchaseCallId = call.getCallbackId();
        pendingProductId = productDetails.getProductId();

        getActivity().runOnUiThread(() -> {
            BillingResult billingResult = billingClient.launchBillingFlow(getActivity(), flowBuilder.build());
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                PluginCall savedCall = bridge.getSavedCall(pendingPurchaseCallId);
                if (savedCall != null) {
                    savedCall.reject("Google Play billing flow failed", String.valueOf(billingResult.getResponseCode()));
                    bridge.releaseCall(savedCall);
                }
                pendingPurchaseCallId = null;
                pendingProductId = null;
            }
        });
    }

    private ProductDetails.OneTimePurchaseOfferDetails getPrimaryOffer(ProductDetails productDetails) {
        List<ProductDetails.OneTimePurchaseOfferDetails> offerDetailsList = productDetails.getOneTimePurchaseOfferDetailsList();
        if (offerDetailsList != null && !offerDetailsList.isEmpty()) {
            return offerDetailsList.get(0);
        }

        return null;
    }

    private JSObject serializeProductDetails(ProductDetails productDetails) {
        JSObject serialized = new JSObject();
        ProductDetails.OneTimePurchaseOfferDetails offerDetails = getPrimaryOffer(productDetails);

        serialized.put("productId", productDetails.getProductId());
        serialized.put("title", productDetails.getTitle());
        serialized.put("description", productDetails.getDescription());
        serialized.put("formattedPrice", offerDetails != null ? offerDetails.getFormattedPrice() : null);
        serialized.put("currencyCode", offerDetails != null ? offerDetails.getPriceCurrencyCode() : null);
        serialized.put("priceAmountMicros", offerDetails != null ? offerDetails.getPriceAmountMicros() : null);
        serialized.put("offerToken", offerDetails != null ? offerDetails.getOfferToken() : null);

        return serialized;
    }

    private JSObject serializePurchase(Purchase purchase) {
        JSObject serialized = new JSObject();
        String productId = purchase.getProducts().isEmpty() ? null : purchase.getProducts().get(0);

        serialized.put("productId", productId);
        serialized.put("purchaseToken", purchase.getPurchaseToken());
        serialized.put("orderId", purchase.getOrderId());
        serialized.put("purchaseTime", purchase.getPurchaseTime());
        serialized.put("acknowledged", purchase.isAcknowledged());
        serialized.put(
            "purchaseState",
            purchase.getPurchaseState() == Purchase.PurchaseState.PENDING ? "PENDING" : "PURCHASED"
        );

        return serialized;
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult billingResult, List<Purchase> purchases) {
        if (pendingPurchaseCallId == null) {
            return;
        }

        PluginCall savedCall = bridge.getSavedCall(pendingPurchaseCallId);
        if (savedCall == null) {
            pendingPurchaseCallId = null;
            pendingProductId = null;
            return;
        }

        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            savedCall.reject("Compra cancelada por el usuario", "USER_CANCELED");
            bridge.releaseCall(savedCall);
            pendingPurchaseCallId = null;
            pendingProductId = null;
            return;
        }

        if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK || purchases == null || purchases.isEmpty()) {
            savedCall.reject("Google Play purchase failed", String.valueOf(billingResult.getResponseCode()));
            bridge.releaseCall(savedCall);
            pendingPurchaseCallId = null;
            pendingProductId = null;
            return;
        }

        Purchase matchedPurchase = null;
        for (Purchase purchase : purchases) {
            if (pendingProductId == null || purchase.getProducts().contains(pendingProductId)) {
                matchedPurchase = purchase;
                break;
            }
        }

        if (matchedPurchase == null) {
            savedCall.reject("No Google Play purchase matched the requested product");
            bridge.releaseCall(savedCall);
            pendingPurchaseCallId = null;
            pendingProductId = null;
            return;
        }

        JSObject result = new JSObject();
        result.put("purchase", serializePurchase(matchedPurchase));
        savedCall.resolve(result);
        bridge.releaseCall(savedCall);
        pendingPurchaseCallId = null;
        pendingProductId = null;
    }
}
