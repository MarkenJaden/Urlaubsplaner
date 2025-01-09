/*
 * OpenHolidays API v1
 *
 * Open Data API for public and school holidays
 *
 * OpenAPI spec version: v1
 *
 * Generated by: https://github.com/swagger-api/swagger-codegen.git
 */

using System.ComponentModel.DataAnnotations;
using System.Runtime.Serialization;
using System.Text;
using Newtonsoft.Json;

namespace OpenHolidaysApi.Model;

/// <summary>
///     Representation of a country as defined in ISO 3166-1
/// </summary>
[DataContract]
public class CountryResponse : IEquatable<CountryResponse>, IValidatableObject
{
    /// <summary>
    ///     Initializes a new instance of the <see cref="CountryResponse" /> class.
    /// </summary>
    /// <param name="isoCode">ISO 3166-1 country code (required).</param>
    /// <param name="name">Localized country names (required).</param>
    /// <param name="officialLanguages">Official ISO-639-1 language codes (required).</param>
    public CountryResponse(string isoCode = default, List<LocalizedText> name = default,
        List<string> officialLanguages = default)
    {
        // to ensure "isoCode" is required (not null)

        IsoCode = isoCode ??
                  throw new InvalidDataException(
                      "isoCode is a required property for CountryResponse and cannot be null");
        // to ensure "name" is required (not null)

        Name = name ??
               throw new InvalidDataException("name is a required property for CountryResponse and cannot be null");
        // to ensure "officialLanguages" is required (not null)

        OfficialLanguages = officialLanguages ??
                            throw new InvalidDataException(
                                "officialLanguages is a required property for CountryResponse and cannot be null");
    }

    /// <summary>
    ///     ISO 3166-1 country code
    /// </summary>
    /// <value>ISO 3166-1 country code</value>
    [DataMember(Name = "isoCode", EmitDefaultValue = false)]
    public string IsoCode { get; set; }

    /// <summary>
    ///     Localized country names
    /// </summary>
    /// <value>Localized country names</value>
    [DataMember(Name = "name", EmitDefaultValue = false)]
    public List<LocalizedText> Name { get; set; }

    /// <summary>
    ///     Official ISO-639-1 language codes
    /// </summary>
    /// <value>Official ISO-639-1 language codes</value>
    [DataMember(Name = "officialLanguages", EmitDefaultValue = false)]
    public List<string> OfficialLanguages { get; set; }

    /// <summary>
    ///     Returns true if CountryResponse instances are equal
    /// </summary>
    /// <param name="input">Instance of CountryResponse to be compared</param>
    /// <returns>Boolean</returns>
    public bool Equals(CountryResponse input)
    {
        if (input == null)
            return false;

        return
            (
                IsoCode == input.IsoCode ||
                (IsoCode != null &&
                 IsoCode.Equals(input.IsoCode))
            ) &&
            (
                Name == input.Name ||
                (Name != null &&
                 input.Name != null &&
                 Name.SequenceEqual(input.Name))
            ) &&
            (
                OfficialLanguages == input.OfficialLanguages ||
                (OfficialLanguages != null &&
                 input.OfficialLanguages != null &&
                 OfficialLanguages.SequenceEqual(input.OfficialLanguages))
            );
    }

    /// <summary>
    ///     To validate all properties of the instance
    /// </summary>
    /// <param name="validationContext">Validation context</param>
    /// <returns>Validation Result</returns>
    IEnumerable<ValidationResult> IValidatableObject.Validate(ValidationContext validationContext)
    {
        yield break;
    }

    /// <summary>
    ///     Returns the string presentation of the object
    /// </summary>
    /// <returns>String presentation of the object</returns>
    public override string ToString()
    {
        var sb = new StringBuilder();
        sb.Append("class CountryResponse {\n");
        sb.Append("  IsoCode: ").Append(IsoCode).Append("\n");
        sb.Append("  Name: ").Append(Name).Append("\n");
        sb.Append("  OfficialLanguages: ").Append(OfficialLanguages).Append("\n");
        sb.Append("}\n");
        return sb.ToString();
    }

    /// <summary>
    ///     Returns the JSON string presentation of the object
    /// </summary>
    /// <returns>JSON string presentation of the object</returns>
    public virtual string ToJson()
    {
        return JsonConvert.SerializeObject(this, Formatting.Indented);
    }

    /// <summary>
    ///     Returns true if objects are equal
    /// </summary>
    /// <param name="input">Object to be compared</param>
    /// <returns>Boolean</returns>
    public override bool Equals(object input)
    {
        return Equals(input as CountryResponse);
    }

    /// <summary>
    ///     Gets the hash code
    /// </summary>
    /// <returns>Hash code</returns>
    public override int GetHashCode()
    {
        unchecked // Overflow is fine, just wrap
        {
            var hashCode = 41;
            if (IsoCode != null)
                hashCode = hashCode * 59 + IsoCode.GetHashCode();
            if (Name != null)
                hashCode = hashCode * 59 + Name.GetHashCode();
            if (OfficialLanguages != null)
                hashCode = hashCode * 59 + OfficialLanguages.GetHashCode();
            return hashCode;
        }
    }
}