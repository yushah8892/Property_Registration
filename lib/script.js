/**
 * Initiate transaction for createProperty
 * @param {org.upgrad.network.CreateProperty} tx - the transaction to be processed
 * @transaction
 */
async function createPropertyTx(tx) {
	const NS = 'org.upgrad.network';
	const me = getCurrentParticipant();

	const property = getFactory().newResource(NS, 'Property', tx.propertyId);

	property.marketPrice = tx.marketPrice;
	property.registrationDate = tx.registrationDate;
	property.propertyType = tx.propertyType;
	property.location = tx.location;
	property.owner = me;
	property.status = 'Registered';
	let assetRegistry = await getAssetRegistry(property.getFullyQualifiedType());
	const exists = await assetRegistry.get(tx.propertyId)
		.catch(function (error) {
			// Add optional error handling here.
			console.log(error);
		});

	if (exists) {
		throw new Error('property with this ID already exists.');
	} else {
		await assetRegistry.add(property);
	}

}
/**
 * Initiate transaction for IntentForSale
 * @param {org.upgrad.network.IntentForSale} tx - the transaction to be processed
 * @transaction
 */
async function intentForsaleTx(tx) {
	const NS = 'org.upgrad.network';
	let assetRegistry = await getAssetRegistry('org.upgrad.network.Property');
	property = await assetRegistry.get(tx.property.propertyId)
		.catch(function (error) {
			throw new Error('property with this ID does not exists.');
		});
	if (getCurrentParticipant().userId !== property.owner.getIdentifier()) {
		throw new Error('Only Owner of the Property can sell his property.');
	}
	property.status = 'Intent For Sale';

	await assetRegistry.update(property)
		.catch(function (error) {
			throw new Error(error);
		});
	const propertyListing = getFactory().newResource(NS, 'PropertyListing', property.propertyId);
	propertyListing.property = property;

	let propertyListingAssetRegistery = await getAssetRegistry('org.upgrad.network.PropertyListing');
	await propertyListingAssetRegistery.add(propertyListing)
		.catch(function (error) {
			throw new Error(error);
		});

}
/**
 * Initiate transaction for Purchase Property
 * @param {org.upgrad.network.PurchaseProperty} tx - the transaction to be processed
 * @transaction
 */
async function purchaseProperty(tx) {

	let propListingassetRegistry = await getAssetRegistry('org.upgrad.network.PropertyListing');
	const propertyListing = await propListingassetRegistry.get(tx.propertyListing.propertyListingId)
		.catch(function (error) {
			throw new Error('property with this ID does not exists.');
		});

	let propertyAssetRegistry = await getAssetRegistry('org.upgrad.network.Property');
	let property = await propertyAssetRegistry.get(tx.propertyListing.property.propertyId)
		.catch(function (error) {
			throw new Error('property with this ID does not exists.');
		});

	const me = getCurrentParticipant();
	const buyer = me;
	const ownerId = property.owner.getIdentifier();

	if (buyer.userId === ownerId) {
		throw new Error('Same user can not buy this property.')
	}

	if (buyer.balance <= property.marketPrice) {
		throw new Error('buyer has insufficient balance to purchase this property.');
	}


	const participantRegistary = await getParticipantRegistry('org.upgrad.network.User');

	//Update Buyer Balance 
	buyer.balance = buyer.balance - property.marketPrice;
	await participantRegistary.update(buyer)
		.catch(function (error) {
			throw new Error('Unable to Update Buyer Participant.');
		});

	//Update Owner Balance

	const ownerParticipant = await participantRegistary.get(ownerId)
		.catch(function (error) {
			throw new Error('Unable to get Owner Participant.');
		});

	ownerParticipant.balance += property.marketPrice;

	await participantRegistary.update(ownerParticipant)
		.catch(function (error) {
			throw new Error('Unable to update Owner Participant.');
		});

	//change the property ownership
	property.owner = buyer;
	property.status = "Registered";
	//update new Property to the registry
	const propertyAssetRegistery = getAssetRegistry('org.upgrad.network.Property')
		.then(function (propertyAssetRegistery) {
			return propertyAssetRegistery.update(property);

		})
		.catch(function (error) {
			throw new Error('Propery Transfer Failed.');
		})

	//Remove Property from Property Listing
	await propListingassetRegistry.remove(propertyListing)
		.catch(function (error) {
			throw new Error('Unable to remove property from PropertyListing Registery.')
		});

}

