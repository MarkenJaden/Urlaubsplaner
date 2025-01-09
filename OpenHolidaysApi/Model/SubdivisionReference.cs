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
///     Representation of a subdivision reference
/// </summary>
[DataContract]
public class SubdivisionReference : IEquatable<SubdivisionReference>, IValidatableObject
{
    /// <summary>
    ///     Initializes a new instance of the <see cref="SubdivisionReference" /> class.
    /// </summary>
    /// <param name="code">Subdivision code (required).</param>
    /// <param name="shortName">Short name for display (required).</param>
    public SubdivisionReference(string code = default, string shortName = default)
    {
        // to ensure "code" is required (not null)

        Code = code ??
               throw new InvalidDataException(
                   "code is a required property for SubdivisionReference and cannot be null");
        // to ensure "shortName" is required (not null)

        ShortName = shortName ??
                    throw new InvalidDataException(
                        "shortName is a required property for SubdivisionReference and cannot be null");
    }

    /// <summary>
    ///     Subdivision code
    /// </summary>
    /// <value>Subdivision code</value>
    [DataMember(Name = "code", EmitDefaultValue = false)]
    public string Code { get; set; }

    /// <summary>
    ///     Short name for display
    /// </summary>
    /// <value>Short name for display</value>
    [DataMember(Name = "shortName", EmitDefaultValue = false)]
    public string ShortName { get; set; }

    /// <summary>
    ///     Returns true if SubdivisionReference instances are equal
    /// </summary>
    /// <param name="input">Instance of SubdivisionReference to be compared</param>
    /// <returns>Boolean</returns>
    public bool Equals(SubdivisionReference input)
    {
        if (input == null)
            return false;

        return
            (
                Code == input.Code ||
                (Code != null &&
                 Code.Equals(input.Code))
            ) &&
            (
                ShortName == input.ShortName ||
                (ShortName != null &&
                 ShortName.Equals(input.ShortName))
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
        sb.Append("class SubdivisionReference {\n");
        sb.Append("  Code: ").Append(Code).Append("\n");
        sb.Append("  ShortName: ").Append(ShortName).Append("\n");
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
        return Equals(input as SubdivisionReference);
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
            if (Code != null)
                hashCode = hashCode * 59 + Code.GetHashCode();
            if (ShortName != null)
                hashCode = hashCode * 59 + ShortName.GetHashCode();
            return hashCode;
        }
    }
}