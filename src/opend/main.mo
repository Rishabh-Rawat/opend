import Text "mo:base/Text";
import Principal "mo:base/Principal";
import Debug "mo:base/Debug";
import NFTActorClass "../NFT/nft";
import Cycles "mo:base/ExperimentalCycles";
import HashMap "mo:base/HashMap";
import List "mo:base/List";
import Bool "mo:base/Bool";
import Iter "mo:base/Iter";

actor OpenD {

    private type Listing = {
        itemOwner : Principal;
        itemPrice : Nat;
    };

    var mapOfNFTs = HashMap.HashMap<Principal, NFTActorClass.NFT>(1, Principal.equal, Principal.hash);
    var mapOfOwners = HashMap.HashMap<Principal, List.List<Principal>>(1, Principal.equal, Principal.hash);
    var mapOfListings = HashMap.HashMap<Principal, Listing>(1, Principal.equal, Principal.hash);

    public shared (msg) func mint(imgData : [Nat8], name : Text) : async (Principal) {
        let owner : Principal = msg.caller;

        Debug.print(debug_show (Cycles.balance()));
        Cycles.add(100_500_000_000);
        let newNFT = await NFTActorClass.NFT(name, owner, imgData);
        Debug.print(debug_show (Cycles.balance()));

        let newNFTPrincipal = await newNFT.getCanisterId();

        mapOfNFTs.put(newNFTPrincipal, newNFT);
        addToOwnershipMap(owner, newNFTPrincipal);

        return newNFTPrincipal;
    };

    private func addToOwnershipMap(owner : Principal, nftId : Principal) {
        var ownedNFTs : List.List<Principal> = switch (mapOfOwners.get(owner)) {
            case (?value) { value };
            case (null) { List.nil<Principal>() };
        };

        ownedNFTs := List.push(nftId, ownedNFTs);

        mapOfOwners.put(owner, ownedNFTs);
    };

    public query func getOwnedNFTs(user : Principal) : async ([Principal]) {
        let userNFTs : List.List<Principal> = switch (mapOfOwners.get(user)) {
            case (?value) { value };
            case (null) { List.nil<Principal>() };
        };
        return List.toArray(userNFTs);
    };

    public shared (msg) func listItem(id : Principal, price : Nat) : async (Text) {

        var item : NFTActorClass.NFT = switch (mapOfNFTs.get(id)) {
            case (?value) { value };
            case (null) { return "NFTs doesn't exist" };
        };

        let owner = await item.getOwner();
        if (Principal.equal(owner, msg.caller)) {
            let newListing : Listing = {
                itemOwner = owner;
                itemPrice = price;
            };
            mapOfListings.put(id, newListing);
            return "Listed successfully";
        } else {
            return "You don't own the NFT.";
        };

    };

    public query func getOpenDCanisterId() : async (Principal) {
        return Principal.fromActor(OpenD);
    };

    public query func isListed(id : Principal) : async (Bool) {
        if (mapOfListings.get(id) == null) {
            return false;
        } else {
            return true;
        };
    };

    public query func getListedNFTs() : async ([Principal]) {
        let ids = Iter.toArray(mapOfListings.keys());
        return ids;
    };

    public query func getOriginalOwner(id : Principal) : async (Principal) {
        var listing : Listing = switch (mapOfListings.get(id)) {
            case (?value) { value };
            case (null) { return Principal.fromText("") };
        };

        return listing.itemOwner;
    };
    public query func getPrice(id : Principal) : async (Nat) {
        var listing : Listing = switch (mapOfListings.get(id)) {
            case (?value) { value };
            case (null) { return 0 };
        };

        return listing.itemPrice;
    };

    public shared (msg) func completePurchase(id : Principal, owner : Principal, new_owner : Principal) : async (Text) {
        var purchasedNFT : NFTActorClass.NFT = switch (mapOfNFTs.get(id)) {
            case (?value) { value };
            case (null) { return "NFT doens't exist" };
        };

        let transferResult = await purchasedNFT.transferOwnership(new_owner);

        if (transferResult == "Ownership transferred successfully.") {
            mapOfListings.delete(id);

            var ownedNFTs : List.List<Principal> = switch (mapOfOwners.get(owner)) {
                case (?value) { value };
                case (null) { List.nil<Principal>() };
            };

            ownedNFTs := List.filter(
                ownedNFTs,
                func(listItemId : Principal) : (Bool) {
                    return listItemId != id;
                },
            );

            addToOwnershipMap(new_owner, id);
            return "Success";
        } else {
            return transferResult;
        };

    };
};
